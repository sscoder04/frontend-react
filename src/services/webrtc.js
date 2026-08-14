import { socket } from "./socket.js";
import { createEmitter } from "./emitter.js";

// ---------------------------------------------------------------------
// State — same shape/names as the original client.js module-level state.
// These remain the single source of truth for WebRTC/Socket.IO state.
// React never mutates these directly; it only reads what's broadcast
// through `bus` below.
// ---------------------------------------------------------------------

// map: socket.id -> username (identical role to original client.js `map`)
export const map = new Map();
// peerConnectionMap: socket.id -> RTCPeerConnection (identical role to original)
export const peerConnectionMap = new Map();
// every MediaStream this client has acquired via getUserMedia this session.
// The original app acquired local media in more than one place (once for the
// local preview tile in userInfoHandler.js, and again per-peer-connection in
// mediaFunctions.js's initialise()) and wired mic/camera buttons independently
// in each place. We keep that same "acquire per connection" behavior, but
// track every stream centrally so a single mic/camera control can affect all
// of them at once (see toggleMic/toggleCamera below).
const localMediaStreams = [];

export const bus = createEmitter();
// Events emitted on `bus`:
//   "local-preview" (stream)                 — the local user's own preview stream
//   "participant-track" (id, stream)         — a remote participant's media arrived
//   "participant-joined" (id, username)      — roster gained someone (name only, no media yet)
//   "participant-left" (id)                  — someone disconnected
//   "connection-state" (id, state)           — peer connection state changed, for UI status

let handlersRegistered = false;

// Every RTCPeerConnection created below previously had zero configuration,
// which means ICE could only gather "host" candidates (your machine's local
// network address). That works by accident on localhost or when both peers
// are on the same LAN, but fails silently across real networks — neither
// side ever gets a NAT-traversed path to the other, so no track event ever
// fires. This is additive configuration, not a change to the signaling
// logic itself.
//
// STUN alone (stun.l.google.com) only helps peers discover their own public
// address — it doesn't help when a direct path still isn't reachable (e.g.
// symmetric NAT, restrictive corporate firewalls). TURN relays media
// through a third-party server in that case, at the cost of that server's
// bandwidth.
//
// Defaults to the Open Relay Project's free public TURN server — fine for
// testing and small/low-traffic use, but it's shared/rate-limited and has
// no uptime guarantee. For production, set these three env vars to your
// own TURN provider's credentials (Metered, Twilio, Xirsys, etc.) and they
// override the public fallback automatically:
//   VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL
const turnUrl = import.meta.env.VITE_TURN_URL;
const turnUsername = import.meta.env.VITE_TURN_USERNAME;
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    turnUrl && turnUsername && turnCredential
      ? { urls: turnUrl, username: turnUsername, credential: turnCredential }
      : {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp",
          ],
          username: "openrelayproject",
          credential: "openrelayproject",
        },
  ],
};

export const createVideoElem = () => {
  // Preserved for parity with the original export, though React no longer
  // needs to create <video> elements manually — VideoTile owns that via a ref.
  return document.createElement("video");
};

// ---------------------------------------------------------------------
// mediaFunctions.js -> initialise()
// Identical logic: acquire media, add tracks to the given peer connection.
// The only change is that button click listeners are gone (no DOM buttons
// exist anymore) — mic/camera state is instead controlled by toggleMic /
// toggleCamera below, which act on every stream in localMediaStreams.
// ---------------------------------------------------------------------
export const initialise = async (peerConnection, user) => {
  const media = await navigator.mediaDevices.getUserMedia({
    video: {
      height: 380,
      width: 380,
    },
    audio: true,
  });

  localMediaStreams.push(media);

  for (const track of media.getTracks()) {
    peerConnection.addTrack(track, media);
    console.log("track sent to ", user);
  }

  return media;
};

// ---------------------------------------------------------------------
// socketFunctions.js -> makeOffer / sendAnswer
// Unchanged signaling logic.
// ---------------------------------------------------------------------
export const makeOffer = async (peerConnection, id) => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer, id);
};

export const sendAnswer = async (peerConnection, offer, id) => {
  await initialise(peerConnection, map.get(id));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, id);
};

// ---------------------------------------------------------------------
// socketHandlers/newUserHandler.js
// Identical peer connection setup. DOM video-tile creation replaced with
// a "participant-track" emit.
// ---------------------------------------------------------------------
const newUserHandler = (id, username) => {
  map.set(id, username);
  peerConnectionMap.set(id, new RTCPeerConnection(ICE_SERVERS));
  const pc = peerConnectionMap.get(id);

  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      console.log("new candidate sent to", map.get(id));
      socket.emit("newCandidate", event.candidate, id);
    }
  });

  pc.addEventListener("connectionstatechange", () => {
    bus.emit("connection-state", id, pc.connectionState);
  });

  pc.addEventListener("track", ({ streams: [stream] }) => {
    console.log("media added recieved from", map.get(id));
    bus.emit("participant-track", id, stream);
  });

  bus.emit("participant-joined", id, username);
};

// ---------------------------------------------------------------------
// socketHandlers/offerHandler.js — unchanged logic.
// ---------------------------------------------------------------------
const offerHandler = async (offer, id) => {
  console.log("offer recieved");
  const currPeerConnection = peerConnectionMap.get(id);

  try {
    await currPeerConnection.setRemoteDescription(offer);
    console.log(currPeerConnection.remoteDescription);
  } catch (err) {
    console.log("error;", err);
  }

  sendAnswer(currPeerConnection, offer, id)
    .then(() => console.log("answer sent"))
    .catch((err) => console.log("error-", err));
};

// ---------------------------------------------------------------------
// socketHandlers/answerHandler.js — unchanged logic.
// ---------------------------------------------------------------------
const answerHandler = async (answer, id) => {
  console.log("answer recieved");
  const pc = peerConnectionMap.get(id);

  pc.addEventListener("connectionstatechange", () => {
    console.log("connection:", pc.connectionState);
  });

  try {
    await pc.setRemoteDescription(answer);
  } catch (err) {
    console.log("error", err);
  }
};

// ---------------------------------------------------------------------
// socketHandlers/newCandidate.js — unchanged logic.
// ---------------------------------------------------------------------
const newCandidateHandler = async (candidate, id) => {
  const pc = peerConnectionMap.get(id);
  await pc.addIceCandidate(candidate);
  console.log("neew candidate added from", map.get(id));
};

// ---------------------------------------------------------------------
// socketHandlers/DisconnectHandler.js
// Identical cleanup of map/peerConnectionMap. DOM element removal replaced
// with a "participant-left" emit.
// ---------------------------------------------------------------------
const disconnectHandler = (id) => {
  console.log("deleting disconnected from map", id);
  map.delete(id);
  peerConnectionMap.delete(id);
  bus.emit("participant-left", id);
  console.log("after disconnection", peerConnectionMap);
};

// ---------------------------------------------------------------------
// socketHandlers/userInfoHandler.js
// Identical logic: acquire local preview media, then for every existing
// room member, create a peer connection, wire it up, initialise media, and
// make an offer. DOM local-video assignment replaced with "local-preview"
// emit; mic/camera button wiring removed (handled centrally, see below).
// ---------------------------------------------------------------------
const userInfoEventHandler = async (data) => {
  for (const [key, val] of data) {
    map.set(key, val);
  }

  const localPreview = await navigator.mediaDevices.getUserMedia({
    video: {
      height: 200,
      width: 200,
    },
  });
  localMediaStreams.push(localPreview);
  bus.emit("local-preview", localPreview);

  if (map.size > 1) {
    for (const pair of map) {
      if (pair[0] !== socket.id) {
        const peerConnection = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionMap.set(pair[0], peerConnection);

        peerConnection.addEventListener("icecandidate", (event) => {
          console.log("new candidate sent to", map.get(pair[0]));
          socket.emit("newCandidate", event.candidate, pair[0]);
        });

        peerConnection.addEventListener("connectionstatechange", () => {
          bus.emit("connection-state", pair[0], peerConnection.connectionState);
        });

        peerConnection.addEventListener("track", ({ streams: [stream] }) => {
          console.log(stream);
          console.log(stream.getTracks());
          bus.emit("participant-track", pair[0], stream);
        });

        bus.emit("participant-joined", pair[0], pair[1]);

        try {
          await initialise(peerConnection, map.get(pair[0]));
        } catch (err) {
          console.log("error:", err);
        }

        makeOffer(peerConnection, pair[0])
          .then(() => console.log("offer Created succesfully"))
          .catch((err) => console.log("error", err));
      }
    }
  }
};

// ---------------------------------------------------------------------
// client.js — the join flow + socket.on wiring. Identical event names and
// payloads. Guarded so React StrictMode's mount/unmount/mount dev cycle
// cannot register duplicate listeners or spin up duplicate connections.
// ---------------------------------------------------------------------
export const joinMeeting = ({ username, room }) => {
  if (handlersRegistered) return;
  handlersRegistered = true;

  socket.emit("join", { username, room });

  socket.on("userInfo", (data) => {
    userInfoEventHandler(data);
  });

  socket.on("offer", (offer, id) => {
    offerHandler(offer, id);
  });

  socket.on("answer", (answer, id) => {
    answerHandler(answer, id);
  });

  socket.on("newUser", (id, username) => {
    newUserHandler(id, username);
  });

  socket.on("userDisconnected", (id) => {
    disconnectHandler(id);
  });

  socket.on("newCandidate", (candidate, id) => {
    newCandidateHandler(candidate, id);
  });
};

export const leaveMeeting = () => {
  // Preserves the original "leave room" behavior (controls.js just navigated
  // back to "/"), extended to also tear down this client's own connections
  // so the tab doesn't keep sending audio/video after leaving.
  for (const pc of peerConnectionMap.values()) {
    pc.close();
  }
  peerConnectionMap.clear();
  for (const stream of localMediaStreams) {
    stream.getTracks().forEach((track) => track.stop());
  }
  localMediaStreams.length = 0;
  socket.disconnect();
};

// ---------------------------------------------------------------------
// Mic/camera control. The original app wired independent button listeners
// per acquired stream (once in userInfoHandler.js, again in every call to
// initialise()), each toggling only the stream in its own closure. Re-doing
// that literally in React would mean re-attaching N duplicate handlers to
// one button on every render, which breaks under React's render model. This
// preserves the same end result — one control mutes/unmutes every stream
// this client has sent — driven by a single explicit state value instead.
// ---------------------------------------------------------------------
export const toggleMic = (enabled) => {
  localMediaStreams.forEach((stream) => {
    stream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  });
};

export const toggleCamera = (enabled) => {
  localMediaStreams.forEach((stream) => {
    stream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  });
};
