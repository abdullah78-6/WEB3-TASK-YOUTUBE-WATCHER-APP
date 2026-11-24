# Architecture Overview — SyncTube Watch Party

## 1. High-Level Flow

```text
+-------------------+        REST (/api/rooms)        +---------------------------+
|   React + Tailwind| ------------------------------> |  Express MVC Controllers  |
|   (Single         |                                 |  (roomController.js)      |
|    BACKEND_URL    | <==== Socket.IO WebSockets ===> |  (socketController.js)    |
|    via props)     |                                 +-------------+-------------+
+-------------------+                                               |
                                                                    v
                                                      +---------------------------+
                                                      | OOP RoomManager           |
                                                      |  └─ RoomSession           |
                                                      |      ├─ Participant(s)    |
                                                      |      ├─ Playback State    |
                                                      |      └─ Pending Requests  |
                                                      +-------------+-------------+
                                                                    |
                                                                    v
                                                      +---------------------------+
                                                      | MongoDB (Mongoose Room)   |
                                                      +---------------------------+
```

## 2. How WebSockets & Synchronization Work

1. **Room Creation & Verified Host Identity**:
   - The creator calls `POST /api/rooms`, which creates a `RoomSession`, persists it to MongoDB, and returns a random `hostToken`.
   - When the creator emits `join_room` with `{ roomId, username, hostToken }`, the server verifies `hostToken` and assigns the `Host` role. Joiners without `hostToken` receive `Participant` by default.
2. **Drift-Corrected Sync State**:
   - Each `RoomSession` tracks `{ videoId, playState, currentTime, lastStateUpdatedAt }`.
   - When `playState === "playing"`, `getLiveCurrentTime()` adds `(Date.now() - lastStateUpdatedAt) / 1000` so late joiners jump directly to the live position instead of where playback started.
3. **Echo-Loop Prevention on the Client**:
   - `YouTubePlayer.jsx` guards programmatic `seekTo`, `playVideo`, `pauseVideo`, and `loadVideoById` calls with `isSyncingRef` so incoming `sync_state` updates never re-emit `play`/`pause` events back to the server.
4. **Backend Role Enforcement & Approval Flow**:
   - Every playback/moderation socket event checks `participant.canControl()` (`Host` or `Moderator`) or `participant.isHost()` (`Host` only) on the server before mutating room state.
   - `Participant` and `Viewer` users emit `request_change`, which notifies Hosts and Moderators. When a Host/Moderator emits `resolve_change_request({ requestId, approved: true })`, the server applies the action and broadcasts `sync_state` to the entire room.

## 3. Scaling Beyond a Single Server (1,000+ Users / 100+ Rooms)

To scale horizontally across multiple Node.js instances behind a sticky-session load balancer:
- Attach `@socket.io/redis-adapter` with Redis Pub/Sub so `io.to(roomId).emit(...)` fans out across all server instances.
- Move active participant presence and pending change requests into Redis hashes keyed by `room:{roomId}` while keeping durable room metadata and chat history in MongoDB with connection pooling.
