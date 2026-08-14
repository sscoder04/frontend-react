import { socket } from "./socket.js";
import { createEmitter } from "./emitter.js";

export const map = new Map();
export const peerConnectionMap = new Map();

const localMediaStreams = [];

export const bus = createEmitter();

let handlersRegistered = false;

/*
|--------------------------------------------------------------------------
| ICE / STUN / TURN
|--------------------------------------------------------------------------
|
| STUN helps peers discover their public network address.
| TURN is required when a direct peer-to-peer connection is impossible.
|
| Add these to your frontend environment:
|
| VITE_TURN_URL=
| VITE_TURN_USERNAME=
| VITE_TURN_CREDENTIAL=
|
*/

const turnUrl = import.meta.env.VITE_TURN_URL;
const turnUsername = import.meta.env.VITE_TURN_USERNAME;
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

const iceServers = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

if (turnUrl && turnUsername && turnCredential) {
  iceServers.push({
    urls: turnUrl,
    username: turnUsername,
    credential: turnCredential,
  });
}

const ICE_SERVERS = {
  iceServers,
};

/*
|--------------------------------------------------------------------------
| IMPORTANT
|--------------------------------------------------------------------------
|
| ICE candidates can arrive BEFORE setRemoteDescription() finishes.
|
| Therefore we temporarily store them here.
|
| socket.id -> candidate[]
|
*/

const pendingCandidates = new Map();

/*
|--------------------------------------------------------------------------
| Local media
|--------------------------------------------------------------------------
*/

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
  }

  console.log("Local tracks added for:", user);

  return media;
};

/*
|--------------------------------------------------------------------------
| Create offer
|--------------------------------------------------------------------------
*/

export const makeOffer = async (peerConnection, id) => {
  try {
    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);

    console.log("Sending offer to:", map.get(id));

    socket.emit("offer", peerConnection.localDescription, id);
  } catch (err) {
    console.error("Error creating offer:", err);
  }
};

/*
|--------------------------------------------------------------------------
| Create answer
|--------------------------------------------------------------------------
*/

export const sendAnswer = async (peerConnection, offer, id) => {
  try {
    /*
     * At this point the offer has already been set as the
     * remote description by offerHandler().
     */

    await initialise(peerConnection, map.get(id));

    const answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    console.log("Sending answer to:", map.get(id));

    socket.emit("answer", peerConnection.localDescription, id);
  } catch (err) {
    console.error("Error creating answer:", err);
  }
};

/*
|--------------------------------------------------------------------------
| Attach common PeerConnection handlers
|--------------------------------------------------------------------------
*/

const setupPeerConnection = (id, peerConnection) => {

  /*
   * ICE candidate
   */

  peerConnection.addEventListener("icecandidate", (event) => {

    if (!event.candidate) {
      return;
    }

    console.log(
      "Sending ICE candidate to:",
      map.get(id)
    );

    socket.emit(
      "newCandidate",
      event.candidate,
      id
    );
  });

  /*
   * ICE state
   */

  peerConnection.addEventListener(
    "iceconnectionstatechange",
    () => {

      console.log(
        "ICE state with",
        map.get(id),
        ":",
        peerConnection.iceConnectionState
      );

      bus.emit(
        "connection-state",
        id,
        peerConnection.connectionState
      );
    }
  );

  /*
   * Overall connection state
   */

  peerConnection.addEventListener(
    "connectionstatechange",
    () => {

      console.log(
        "Connection state with",
        map.get(id),
        ":",
        peerConnection.connectionState
      );

      bus.emit(
        "connection-state",
        id,
        peerConnection.connectionState
      );
    }
  );

  /*
   * Remote media
   */

  peerConnection.addEventListener(
    "track",
    (event) => {

      console.log(
        "Remote track received from:",
        map.get(id)
      );

      const stream = event.streams[0];

      if (!stream) {
        console.warn(
          "Track received without MediaStream"
        );
        return;
      }

      bus.emit(
        "participant-track",
        id,
        stream
      );
    }
  );

  /*
   * Debugging ICE gathering
   */

  peerConnection.addEventListener(
    "icegatheringstatechange",
    () => {

      console.log(
        "ICE gathering with",
        map.get(id),
        ":",
        peerConnection.iceGatheringState
      );
    }
  );

  /*
   * Debugging signaling state
   */

  peerConnection.addEventListener(
    "signalingstatechange",
    () => {

      console.log(
        "Signaling state with",
        map.get(id),
        ":",
        peerConnection.signalingState
      );
    }
  );
};

/*
|--------------------------------------------------------------------------
| New user
|--------------------------------------------------------------------------
*/

const newUserHandler = (id, username) => {

  console.log(
    "New user:",
    username,
    id
  );

  map.set(id, username);

  const peerConnection =
    new RTCPeerConnection(ICE_SERVERS);

  peerConnectionMap.set(
    id,
    peerConnection
  );

  setupPeerConnection(
    id,
    peerConnection
  );

  bus.emit(
    "participant-joined",
    id,
    username
  );
};

/*
|--------------------------------------------------------------------------
| Offer received
|--------------------------------------------------------------------------
*/

const offerHandler = async (offer, id) => {

  console.log(
    "Offer received from:",
    map.get(id)
  );

  const peerConnection =
    peerConnectionMap.get(id);

  if (!peerConnection) {
    console.error(
      "No peer connection exists for:",
      id
    );

    return;
  }

  try {

    /*
     * FIRST:
     * Set remote description.
     */

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    console.log(
      "Remote description set for:",
      map.get(id)
    );

    /*
     * THEN:
     * Add ICE candidates that arrived too early.
     */

    const queuedCandidates =
      pendingCandidates.get(id) || [];

    for (const candidate of queuedCandidates) {

      try {

        await peerConnection.addIceCandidate(
          candidate
        );

        console.log(
          "Queued ICE candidate added from:",
          map.get(id)
        );

      } catch (err) {

        console.error(
          "Error adding queued ICE candidate:",
          err
        );
      }
    }

    pendingCandidates.delete(id);

    /*
     * Finally create the answer.
     */

    await sendAnswer(
      peerConnection,
      offer,
      id
    );

    console.log(
      "Answer successfully sent to:",
      map.get(id)
    );

  } catch (err) {

    console.error(
      "Error handling offer:",
      err
    );
  }
};

/*
|--------------------------------------------------------------------------
| Answer received
|--------------------------------------------------------------------------
*/

const answerHandler = async (answer, id) => {

  console.log(
    "Answer received from:",
    map.get(id)
  );

  const peerConnection =
    peerConnectionMap.get(id);

  if (!peerConnection) {
    console.error(
      "No peer connection exists for:",
      id
    );

    return;
  }

  try {

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );

    console.log(
      "Remote answer set from:",
      map.get(id)
    );

    /*
     * Add candidates that arrived before
     * the answer.
     */

    const queuedCandidates =
      pendingCandidates.get(id) || [];

    for (const candidate of queuedCandidates) {

      try {

        await peerConnection.addIceCandidate(
          candidate
        );

        console.log(
          "Queued ICE candidate added from:",
          map.get(id)
        );

      } catch (err) {

        console.error(
          "Error adding queued ICE candidate:",
          err
        );
      }
    }

    pendingCandidates.delete(id);

  } catch (err) {

    console.error(
      "Error setting remote answer:",
      err
    );
  }
};

/*
|--------------------------------------------------------------------------
| ICE candidate received
|--------------------------------------------------------------------------
*/

const newCandidateHandler = async (
  candidate,
  id
) => {

  const peerConnection =
    peerConnectionMap.get(id);

  if (!peerConnection) {

    console.warn(
      "Received ICE candidate but peer connection doesn't exist:",
      id
    );

    return;
  }

  /*
   * CRITICAL FIX:
   *
   * If remoteDescription isn't set yet,
   * don't call addIceCandidate().
   *
   * Queue it instead.
   */

  if (!peerConnection.remoteDescription) {

    console.log(
      "Queueing ICE candidate from:",
      map.get(id)
    );

    if (!pendingCandidates.has(id)) {
      pendingCandidates.set(
        id,
        []
      );
    }

    pendingCandidates
      .get(id)
      .push(candidate);

    return;
  }

  try {

    await peerConnection.addIceCandidate(
      candidate
    );

    console.log(
      "ICE candidate added from:",
      map.get(id)
    );

  } catch (err) {

    console.error(
      "Error adding ICE candidate:",
      err
    );
  }
};

/*
|--------------------------------------------------------------------------
| Disconnect
|--------------------------------------------------------------------------
*/

const disconnectHandler = (id) => {

  console.log(
    "User disconnected:",
    map.get(id)
  );

  const peerConnection =
    peerConnectionMap.get(id);

  if (peerConnection) {
    peerConnection.close();
  }

  peerConnectionMap.delete(id);
  map.delete(id);
  pendingCandidates.delete(id);

  bus.emit(
    "participant-left",
    id
  );
};

/*
|--------------------------------------------------------------------------
| Existing users when we join
|--------------------------------------------------------------------------
*/

const userInfoEventHandler = async (data) => {

  /*
   * Populate user map.
   */

  for (const [key, val] of data) {
    map.set(key, val);
  }

  /*
   * Local preview.
   *
   * This stream is only for our own video.
   */

  try {

    const localPreview =
      await navigator.mediaDevices.getUserMedia({
        video: {
          height: 200,
          width: 200,
        },
        audio: true,
      });

    localMediaStreams.push(
      localPreview
    );

    bus.emit(
      "local-preview",
      localPreview
    );

  } catch (err) {

    console.error(
      "Could not get local media:",
      err
    );

    return;
  }

  /*
   * We create offers to every user
   * already inside the room.
   */

  for (const [id, username] of map) {

    if (id === socket.id) {
      continue;
    }

    /*
     * Don't accidentally create a second
     * PeerConnection.
     */

    if (peerConnectionMap.has(id)) {
      continue;
    }

    console.log(
      "Creating connection to:",
      username,
      id
    );

    const peerConnection =
      new RTCPeerConnection(
        ICE_SERVERS
      );

    peerConnectionMap.set(
      id,
      peerConnection
    );

    setupPeerConnection(
      id,
      peerConnection
    );

    bus.emit(
      "participant-joined",
      id,
      username
    );

    try {

      await initialise(
        peerConnection,
        username
      );

      await makeOffer(
        peerConnection,
        id
      );

    } catch (err) {

      console.error(
        "Error establishing connection with:",
        username,
        err
      );
    }
  }
};

/*
|--------------------------------------------------------------------------
| Join meeting
|--------------------------------------------------------------------------
*/

export const joinMeeting = ({
  username,
  room,
}) => {

  if (handlersRegistered) {
    return;
  }

  handlersRegistered = true;

  /*
   * Register listeners BEFORE emitting join.
   */

  socket.on(
    "userInfo",
    userInfoEventHandler
  );

  socket.on(
    "offer",
    offerHandler
  );

  socket.on(
    "answer",
    answerHandler
  );

  socket.on(
    "newUser",
    newUserHandler
  );

  socket.on(
    "userDisconnected",
    disconnectHandler
  );

  socket.on(
    "newCandidate",
    newCandidateHandler
  );

  socket.emit(
    "join",
    {
      username,
      room,
    }
  );
};

/*
|--------------------------------------------------------------------------
| Leave meeting
|--------------------------------------------------------------------------
*/

export const leaveMeeting = () => {

  for (const peerConnection of peerConnectionMap.values()) {
    peerConnection.close();
  }

  peerConnectionMap.clear();
  map.clear();
  pendingCandidates.clear();

  for (const stream of localMediaStreams) {

    stream
      .getTracks()
      .forEach((track) => {
        track.stop();
      });

  }

  localMediaStreams.length = 0;

  if (socket.connected) {
    socket.disconnect();
  }

  handlersRegistered = false;
};

/*
|--------------------------------------------------------------------------
| Mic
|--------------------------------------------------------------------------
*/

export const toggleMic = (enabled) => {

  for (const stream of localMediaStreams) {

    for (const track of stream.getAudioTracks()) {
      track.enabled = enabled;
    }

  }
};

/*
|--------------------------------------------------------------------------
| Camera
|--------------------------------------------------------------------------
*/

export const toggleCamera = (enabled) => {

  for (const stream of localMediaStreams) {

    for (const track of stream.getVideoTracks()) {
      track.enabled = enabled;
    }

  }
};