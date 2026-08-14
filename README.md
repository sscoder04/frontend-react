# meetUp — React frontend

This replaces the vanilla-JS `frontend/public` UI with React. **The `backend/` folder is completely untouched** — same Socket.IO events, same signaling flow, same port (8080), same CORS config.

## Run it

The backend's Socket.IO CORS is hardcoded to `http://localhost:3000`, so this app is pinned to port 3000 too (see `vite.config.js`). Run it *instead of* the old `frontend/` Express server, alongside the existing `backend/`:

```bash
# terminal 1 — unchanged
cd backend && npm install && node app.js

# terminal 2 — this app
cd frontend-react && npm install && npm run dev
```

Then open `http://localhost:3000`.

## What changed vs. the original frontend

| Original | This app |
|---|---|
| `login.html` inline script | `src/pages/LoginPage.jsx` — same `sessionStorage` keys (`username`, `room`) |
| `call.html` + manual DOM | `src/pages/MeetingPage.jsx` + component tree |
| `client.js` (socket connect, `map`/`peerConnectionMap`, event wiring) | `src/services/webrtc.js` + `src/services/socket.js` — same variable names, same events, same payloads |
| `socketHandlers/*.js`, `socketFunctions.js`, `mediaFunctions.js` | Ported into `src/services/webrtc.js` as named functions, same logic |
| `createElement('video')` + `appendChild` into `#video_box` | `VideoTile` component, driven by React state updated via a small pub/sub (`bus` in `webrtc.js`) that the original imperative code now emits into instead of touching the DOM |
| Mic/camera `addEventListener` wired independently per acquired stream (a pre-existing quirk — see code comments in `webrtc.js`) | A single `toggleMic`/`toggleCamera` control that applies to every stream this client has sent, preserving the same end-user effect without re-registering duplicate DOM listeners on every render |

## Deliberate, minimal additions (not new features)

- `leaveMeeting()` now also calls `pc.close()`, stops local tracks, and disconnects the socket. The original just did `location.href = "/"`, relying on a full page reload to kill everything. Since this is now a single-page app with no reload, that cleanup is necessary — it's infrastructure, not a new feature.
- `socket.io-client` is imported as an npm package instead of the CDN `<script>` tag, so Vite can bundle it. The `io("http://localhost:8080")` call itself is unchanged.

## Not implemented (because the original didn't have it)

Screen sharing, chat, and a participants panel are **not** in this UI, because they don't exist in the current backend/signaling logic. Wiring up fake buttons for them would be misleading — add the underlying Socket.IO events/WebRTC logic first, and the UI can follow.
