import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../services/socket.js";
import {
  bus,
  joinMeeting,
  leaveMeeting,
  toggleMic,
  toggleCamera,
} from "../services/webrtc.js";

/**
 * Bridges the existing WebRTC/Socket.IO service layer (services/webrtc.js)
 * into React state. This hook does not contain any signaling logic itself —
 * it only listens to the `bus` events that service emits and mirrors them
 * into state so components can render declaratively.
 */
export function useMeeting({ username, room }) {
  const [participants, setParticipants] = useState(new Map());
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connected, setConnected] = useState(socket.connected);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!username || !room) return;

    const unsubs = [
      bus.on("local-preview", (stream) => setLocalStream(stream)),

      bus.on("participant-joined", (id, name) => {
        setParticipants((prev) => {
          const next = new Map(prev);
          const existing = next.get(id) || {};
          next.set(id, { ...existing, id, username: name });
          return next;
        });
      }),

      bus.on("participant-track", (id, stream) => {
        setParticipants((prev) => {
          const next = new Map(prev);
          const existing = next.get(id) || { id };
          next.set(id, { ...existing, stream });
          return next;
        });
      }),

      bus.on("connection-state", (id, state) => {
        setParticipants((prev) => {
          const next = new Map(prev);
          const existing = next.get(id);
          if (!existing) return prev;
          next.set(id, { ...existing, connectionState: state });
          return next;
        });
      }),

      bus.on("participant-left", (id) => {
        setParticipants((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }),
    ];

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (!joinedRef.current) {
      joinedRef.current = true;
      joinMeeting({ username, room });
    }

    return () => {
      unsubs.forEach((unsub) => unsub());
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, room]);

  const handleToggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      toggleMic(next);
      return next;
    });
  }, []);

  const handleToggleCamera = useCallback(() => {
    setCamOn((prev) => {
      const next = !prev;
      toggleCamera(next);
      return next;
    });
  }, []);

  const handleLeave = useCallback(() => {
    leaveMeeting();
  }, []);

  return {
    participants,
    localStream,
    micOn,
    camOn,
    connected,
    toggleMic: handleToggleMic,
    toggleCamera: handleToggleCamera,
    leave: handleLeave,
  };
}
