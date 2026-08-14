import { io } from "socket.io-client";

// Same signaling server, same connection call as the original client.js.
// (Original loaded socket.io-client from a CDN <script> tag; here it's an
// npm dependency instead, purely so it can be bundled by Vite — the actual
// io(...) call is unchanged.)
//
// The target URL is now read from VITE_BACKEND_URL at build time (set this
// in Netlify's env vars, or in a local .env file) so the same code works in
// local dev (defaults to localhost:8080) and in production (pointed at
// wherever the backend is actually deployed, e.g. Render/Railway).
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

export const socket = io(BACKEND_URL);
