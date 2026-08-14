import { useState } from "react";
import { Video } from "lucide-react";
import "./LoginPage.css";

export default function LoginPage({ onJoin }) {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");

  const canJoin = username.trim().length > 0 && room.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canJoin) return;
    // Same persistence mechanism as the original login.html inline script.
    sessionStorage.setItem("username", username.trim());
    sessionStorage.setItem("room", room.trim());
    onJoin({ username: username.trim(), room: room.trim() });
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__logo">
          <Video size={20} strokeWidth={2.2} />
        </div>
        <h1 className="login-card__title">Join a meeting</h1>
        <p className="login-card__subtitle">Enter your name and a room to get started.</p>

        <label className="login-field">
          <span className="login-field__label">Your name</span>
          <input
            id="user"
            className="login-field__input"
            type="text"
            placeholder="e.g. Priya Sharma"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="name"
            autoFocus
          />
        </label>

        <label className="login-field">
          <span className="login-field__label">Room</span>
          <input
            id="room"
            className="login-field__input"
            type="text"
            placeholder="e.g. design-standup"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            autoComplete="off"
          />
        </label>

        <button id="join" type="submit" className="login-card__submit" disabled={!canJoin}>
          Join call
        </button>
      </form>
    </div>
  );
}
