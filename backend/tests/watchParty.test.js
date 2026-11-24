const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { Server } = require("socket.io");
const { io: Client } = require("socket.io-client");
const { createApp } = require("../src/app");
const { registerSocketHandlers } = require("../src/controllers/socketController");

function waitForEvent(socket, eventName, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event "${eventName}"`));
    }, timeoutMs);
    socket.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

test("Full Watch Party REST + Socket.IO RBAC, Sync, Approval Requests & Host Transfer", async (t) => {
  const app = createApp("*");
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });
  registerSocketHandlers(io);

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const sockets = [];
  t.after(async () => {
    for (const s of sockets) s.close();
    await new Promise((resolve) => io.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
  });

  // 1. Create room via REST
  const createRes = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "HostUser",
      name: "Test Cinema",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    }),
  });
  assert.equal(createRes.status, 201);
  const room = await createRes.json();
  assert.ok(room.roomId);
  assert.ok(room.hostToken);
  assert.equal(room.videoId, "dQw4w9WgXcQ");

  // 2. Host joins via WebSocket
  const hostSocket = Client(baseUrl, { transports: ["websocket"] });
  sockets.push(hostSocket);
  const hostJoinedPromise = waitForEvent(hostSocket, "room_joined");
  hostSocket.emit("join_room", {
    roomId: room.roomId,
    username: "HostUser",
    hostToken: room.hostToken,
  });
  const hostJoined = await hostJoinedPromise;
  assert.equal(hostJoined.self.role, "Host");

  // 3. Participant joins via WebSocket
  const guestSocket = Client(baseUrl, { transports: ["websocket"] });
  sockets.push(guestSocket);
  const guestJoinedPromise = waitForEvent(guestSocket, "room_joined");
  guestSocket.emit("join_room", {
    roomId: room.roomId,
    username: "GuestUser",
  });
  const guestJoined = await guestJoinedPromise;
  assert.equal(guestJoined.self.role, "Participant");
  const guestUserId = guestJoined.self.userId;

  // 4. Participant cannot directly play or change video (RBAC)
  const deniedPromise = waitForEvent(guestSocket, "error_message");
  guestSocket.emit("change_video", { videoId: "jfKfPfyJRdk" });
  const denied = await deniedPromise;
  assert.match(denied.message, /Only Host or Moderator/i);

  // 5. Participant submits a change request -> Host approves -> everyone gets sync_state
  const reqReceivedPromise = waitForEvent(hostSocket, "change_request_received");
  guestSocket.emit("request_change", {
    action: "change_video",
    payload: { videoId: "https://www.youtube.com/watch?v=jfKfPfyJRdk" },
  });
  const { request } = await reqReceivedPromise;
  assert.equal(request.action, "change_video");
  assert.equal(request.payload.videoId, "jfKfPfyJRdk");

  const guestSyncAfterApprove = waitForEvent(guestSocket, "sync_state");
  hostSocket.emit("resolve_change_request", {
    requestId: request.requestId,
    approved: true,
  });
  const syncedVideo = await guestSyncAfterApprove;
  assert.equal(syncedVideo.videoId, "jfKfPfyJRdk");

  // 6. Host promotes Participant to Moderator -> Moderator can now play & seek
  const roleUpdatedPromise = waitForEvent(guestSocket, "role_assigned");
  hostSocket.emit("assign_role", { userId: guestUserId, role: "Moderator" });
  const roleUpdated = await roleUpdatedPromise;
  assert.equal(roleUpdated.role, "Moderator");

  const hostSyncAfterModPlay = waitForEvent(hostSocket, "sync_state");
  guestSocket.emit("play", { time: 42 });
  const playedState = await hostSyncAfterModPlay;
  assert.equal(playedState.playState, "playing");
  assert.ok(playedState.currentTime >= 42);

  // 7. Moderator still cannot remove participants (Host only)
  const modDeniedPromise = waitForEvent(guestSocket, "error_message");
  guestSocket.emit("remove_participant", { userId: hostJoined.self.userId });
  const modDenied = await modDeniedPromise;
  assert.match(modDenied.message, /Only the Host/i);

  // 8. Host removes a third participant
  const thirdSocket = Client(baseUrl, { transports: ["websocket"] });
  sockets.push(thirdSocket);
  const thirdJoinedPromise = waitForEvent(thirdSocket, "room_joined");
  thirdSocket.emit("join_room", { roomId: room.roomId, username: "ThirdUser" });
  const thirdJoined = await thirdJoinedPromise;

  const kickedPromise = waitForEvent(thirdSocket, "removed_from_room");
  hostSocket.emit("remove_participant", { userId: thirdJoined.self.userId });
  const kicked = await kickedPromise;
  assert.equal(kicked.roomId, room.roomId);

  // 9. Host transfers host to Moderator
  const transferPromise = waitForEvent(guestSocket, "host_transferred");
  hostSocket.emit("transfer_host", { userId: guestUserId });
  const transferred = await transferPromise;
  assert.equal(transferred.newHostId, guestUserId);
});
