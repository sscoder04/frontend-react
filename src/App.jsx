import { useState } from "react";
import LoginPage from "./pages/LoginPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";

// The original app used two Express routes ("/" and "/call") backed by
// sessionStorage for username/room. This keeps the same sessionStorage
// contract (so a hard refresh on the meeting screen still works) while
// avoiding a router dependency for a two-screen app.
function getStoredIdentity() {
  const username = sessionStorage.getItem("username");
  const room = sessionStorage.getItem("room");
  if (username && room) return { username, room };
  return null;
}

export default function App() {
  const [identity, setIdentity] = useState(getStoredIdentity);

  if (!identity) {
    return <LoginPage onJoin={setIdentity} />;
  }

  return (
    <MeetingPage
      username={identity.username}
      room={identity.room}
      onLeave={() => {
        sessionStorage.removeItem("username");
        sessionStorage.removeItem("room");
        setIdentity(null);
      }}
    />
  );
}
