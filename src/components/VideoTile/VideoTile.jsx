import { useEffect, useRef } from "react";
import { MicOff, WifiOff } from "lucide-react";
import "./VideoTile.css";

export default function VideoTile({
  stream,
  username,
  isLocal = false,
  muted = false,
  micOn = true,
  connectionState,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = (username || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isConnecting =
    !isLocal && connectionState && connectionState !== "connected";

  return (
    <div className="video-tile">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="video-tile__video"
        />
      ) : (
        <div className="video-tile__placeholder" aria-hidden="true">
          <span className="video-tile__avatar">{initials}</span>
        </div>
      )}

      {isConnecting && (
        <div className="video-tile__status" role="status">
          <span className="video-tile__spinner" />
          Connecting…
        </div>
      )}

      <div className="video-tile__footer">
        <span className="video-tile__name">
          {username} {isLocal && <span className="video-tile__you">(You)</span>}
        </span>
        <span className="video-tile__badges">
          {connectionState === "failed" || connectionState === "disconnected" ? (
            <span
              className="video-tile__badge video-tile__badge--danger"
              title="Connection lost"
              aria-label="Connection lost"
            >
              <WifiOff size={13} strokeWidth={2} />
            </span>
          ) : null}
          {isLocal && !micOn && (
            <span
              className="video-tile__badge"
              title="Microphone off"
              aria-label="Microphone off"
            >
              <MicOff size={13} strokeWidth={2} />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
