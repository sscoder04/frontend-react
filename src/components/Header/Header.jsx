import { Users, Video } from "lucide-react";
import "./Header.css";

export default function Header({ room, participantCount, connected }) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__logo" aria-hidden="true">
          <Video size={16} strokeWidth={2.2} />
        </span>
        <span className="app-header__name">meetUp</span>
      </div>

      <div className="app-header__meeting">
        <span className="app-header__room">Room · {room}</span>
      </div>

      <div className="app-header__status">
        <span className="app-header__participants" title="Participants in this room">
          <Users size={14} strokeWidth={2} />
          {participantCount}
        </span>
        <span
          className={`app-header__connection ${
            connected ? "app-header__connection--live" : "app-header__connection--down"
          }`}
        >
          <span className="app-header__dot" aria-hidden="true" />
          {connected ? "Connected" : "Reconnecting…"}
        </span>
      </div>
    </header>
  );
}
