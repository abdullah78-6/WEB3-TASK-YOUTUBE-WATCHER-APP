# SyncTube — YouTube Watch Party System

A full-stack real-time **YouTube Watch Party** application built with **React.js + Tailwind CSS** on the frontend and **Node.js + Express.js + MongoDB (Mongoose) + Socket.IO** using an **MVC + OOP WebSocket architecture** on the backend.

## Features

- **Real-Time Playback Synchronization**: Play, pause, seek (with drift correction), and video changes sync across all participants via WebSockets.
- **Room-Based Watch Parties**: Create a room with a unique 6-character code and shareable invite link (`?room=CODE`), or join an existing room.
- **YouTube IFrame Player API**: Embedded YouTube player controlled programmatically without echo loops.
- **Role-Based Access Control (RBAC)**:
  - **Host** (auto-assigned to room creator): Full playback control, assign roles (`Moderator`, `Participant`, `Viewer`), remove participants, transfer Host role, and approve/reject change requests.
  - **Moderator** (assigned by Host): Play, pause, seek, change video, and approve/reject participant change requests.
  - **Participant / Viewer** (default for joiners): Watch-only mode; can submit playback/video **change requests** that take effect once approved by the Host or a Moderator.
- **Real-Time Room Chat**: Persistent chat messages with participant role badges.
- **Single `backendUrl` Prop Configuration**: Defined in one place (`frontend/src/App.jsx`) and passed down via React props to all pages/components so updating the backend URL takes a single edit.

---

## Project Structure (MVC Backend + React Frontend)

```text
youtube-watch-party/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                # MongoDB connection setup (Mongoose)
│   │   ├── models/
│   │   │   └── Room.js              # Mongoose schema for rooms & chat history
│   │   ├── services/
│   │   │   ├── Participant.js       # OOP Participant entity & role helpers
│   │   │   ├── RoomSession.js       # OOP Room session state, sync & requests
│   │   │   └── RoomManager.js       # Active room registry + DB persistence
│   │   ├── controllers/
│   │   │   ├── roomController.js    # REST API controllers (create/get/list)
│   │   │   └── socketController.js  # Socket.IO event & RBAC controller
│   │   ├── routes/
│   │   │   └── roomRoutes.js        # Express routes (/api/rooms)
│   │   ├── middlewares/
│   │   │   └── errorHandler.js      # 404 & centralized error middleware
│   │   ├── utils/
│   │   │   ├── roles.js             # Role constants & permission validators
│   │   │   └── youtube.js           # YouTube URL / ID parser
│   │   ├── app.js                   # Express app setup
│   │   └── server.js                # HTTP + Socket.IO server entry point
│   ├── tests/
│   │   └── watchParty.test.js       # Automated REST + Socket.IO RBAC tests
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── YouTubePlayer.jsx
│   │   │   ├── PlaybackControls.jsx
│   │   │   ├── ParticipantsPanel.jsx
│   │   │   ├── ChangeRequestsPanel.jsx
│   │   │   └── ChatPanel.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   └── WatchRoomPage.jsx
│   │   ├── utils/
│   │   │   └── youtube.js
│   │   ├── App.jsx                  # Single BACKEND_URL variable passed via props
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
├── ARCHITECTURE.md
└── README.md
```

---

## Changing the Backend URL in One Place

Open `frontend/src/App.jsx` and update the single `BACKEND_URL` variable at the top of the file (or set `VITE_BACKEND_URL` in `frontend/.env`):

```jsx
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
```

`App.jsx` passes `backendUrl={BACKEND_URL}` as a prop to `HomePage` and `WatchRoomPage`, which use it for every REST API `fetch()` call and Socket.IO connection.

---

## Local Setup & Run Instructions

### Prerequisites
- Node.js v18+ (v20+ recommended)
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection string

### 1. Start the Backend

```bash
cd backend
cp .env.example .env
# Edit .env to set MONGO_URI (and PORT / CLIENT_ORIGIN if needed)
npm install
npm run dev
```

The backend runs on `http://localhost:5000` by default.
*(If MongoDB is not running locally, the server logs a warning and still works in in-memory mode so you can test immediately.)*

To run the backend integration test suite:

```bash
cd backend
npm test
```

### 2. Start the Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`. Open two browser tabs to test real-time synchronization, role assignment, and participant approval requests!

---

## WebSocket Events Reference

| Event | Direction | Payload | Access |
|---|---|---|---|
| `join_room` | Client → Server | `{ roomId, username, hostToken? }` | Any |
| `leave_room` | Client → Server | `{ roomId }` | In room |
| `sync_state` | Server → Clients | `{ roomId, name, videoId, playState, currentTime, updatedAt }` | Broadcast |
| `play` | Client → Server | `{ time? }` | Host / Moderator |
| `pause` | Client → Server | `{ time? }` | Host / Moderator |
| `seek` | Client → Server | `{ time }` | Host / Moderator |
| `change_video` | Client → Server | `{ videoId }` | Host / Moderator |
| `assign_role` | Client → Server | `{ userId, role }` | Host only |
| `remove_participant` | Client → Server | `{ userId }` | Host only |
| `transfer_host` | Client → Server | `{ userId }` | Host only |
| `request_change` | Client → Server | `{ action, payload }` | Participant / Viewer |
| `resolve_change_request` | Client → Server | `{ requestId, approved }` | Host / Moderator |
| `send_message` | Client → Server | `{ text }` | In room |
| `user_joined` / `user_left` | Server → Clients | `{ username, userId, role?, participants }` | Broadcast |
| `role_assigned` | Server → Clients | `{ userId, username, role, participants }` | Broadcast |
| `participant_removed` | Server → Clients | `{ userId, username, participants }` | Broadcast |
