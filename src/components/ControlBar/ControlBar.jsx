import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import "./ControlBar.css";

export default function ControlBar({
  micOn,
  camOn,
  onToggleMic,
  onToggleCamera,
  onLeave,
}) {
  return (
    <div className="control-bar" role="toolbar" aria-label="Meeting controls">
      <button
        type="button"
        className={`control-btn ${!micOn ? "control-btn--off" : ""}`}
        onClick={onToggleMic}
        aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        aria-pressed={!micOn}
        title={micOn ? "Mute" : "Unmute"}
      >
        {micOn ? <Mic size={20} strokeWidth={2} /> : <MicOff size={20} strokeWidth={2} />}
        <span className="control-btn__label">{micOn ? "Mute" : "Unmute"}</span>
      </button>

      <button
        type="button"
        className={`control-btn ${!camOn ? "control-btn--off" : ""}`}
        onClick={onToggleCamera}
        aria-label={camOn ? "Turn camera off" : "Turn camera on"}
        aria-pressed={!camOn}
        title={camOn ? "Stop video" : "Start video"}
      >
        {camOn ? <Video size={20} strokeWidth={2} /> : <VideoOff size={20} strokeWidth={2} />}
        <span className="control-btn__label">{camOn ? "Stop video" : "Start video"}</span>
      </button>

      <button
        type="button"
        className="control-btn control-btn--leave"
        onClick={onLeave}
        aria-label="Leave meeting"
        title="Leave"
      >
        <PhoneOff size={20} strokeWidth={2} />
        <span className="control-btn__label">Leave</span>
      </button>
    </div>
  );
}
