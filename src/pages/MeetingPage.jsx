import { useMemo } from "react";
import Header from "../components/Header/Header.jsx";
import VideoGrid from "../components/VideoGrid/VideoGrid.jsx";
import ControlBar from "../components/ControlBar/ControlBar.jsx";
import { useMeeting } from "../hooks/useMeeting.js";
import "./MeetingPage.css";

export default function MeetingPage({ username, room, onLeave }) {
  const {
    participants,
    localStream,
    micOn,
    camOn,
    connected,
    toggleMic,
    toggleCamera,
    leave,
  } = useMeeting({ username, room });

  const localTile = useMemo(
    () => ({
      id: "local",
      stream: localStream,
      username,
      isLocal: true,
      muted: true,
      micOn,
    }),
    [localStream, username, micOn]
  );

  const remoteTiles = useMemo(
    () =>
      Array.from(participants.values()).map((p) => ({
        id: p.id,
        stream: p.stream,
        username: p.username || "Participant",
        connectionState: p.connectionState,
      })),
    [participants]
  );

  const handleLeave = () => {
    leave();
    onLeave();
  };

  return (
    <div className="meeting-page">
      <Header
        room={room}
        participantCount={remoteTiles.length + 1}
        connected={connected}
      />
      <VideoGrid localTile={localTile} participants={remoteTiles} />
      <ControlBar
        micOn={micOn}
        camOn={camOn}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onLeave={handleLeave}
      />
    </div>
  );
}
