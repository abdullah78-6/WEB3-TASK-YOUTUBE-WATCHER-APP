const roomManager = require("../services/RoomManager");
const { isValidAssignableRole, ROLES } = require("../utils/roles");
const { extractYouTubeVideoId } = require("../utils/youtube");

const ALLOWED_REQUEST_ACTIONS = new Set(["play", "pause", "seek", "change_video"]);

function emitError(socket, message) {
  socket.emit("error_message", { message });
}

function getAuthorizedContext(socket) {
  const session = roomManager.getRoomBySocket(socket.id);
  if (!session) {
    emitError(socket, "You are not currently in a room.");
    return null;
  }
  const participant = session.getParticipantBySocket(socket.id);
  if (!participant) {
    emitError(socket, "Participant session not found.");
    return null;
  }
  return { session, participant };
}

function emitPendingRequestsToControllers(io, session) {
  const pendingRequests = session.getPendingRequests();
  for (const participant of session.participants.values()) {
    if (participant.canControl()) {
      io.to(participant.socketId).emit("pending_requests_updated", {
        requests: pendingRequests,
      });
    }
  }
}

async function handleLeaveOrDisconnect(io, socket) {
  const roomId = roomManager.untrackSocket(socket.id);
  if (!roomId) return;

  const session = await roomManager.getOrLoadRoom(roomId);
  if (!session) return;

  const { removed, promotedHost } = session.removeParticipantBySocket(socket.id);
  socket.leave(session.roomId);

  if (!removed) return;

  const participants = session.getParticipantsList();
  io.to(session.roomId).emit("user_left", {
    username: removed.username,
    userId: removed.userId,
    participants,
  });

  if (promotedHost) {
    io.to(session.roomId).emit("role_assigned", {
      userId: promotedHost.userId,
      username: promotedHost.username,
      role: promotedHost.role,
      participants,
    });
  }

  emitPendingRequestsToControllers(io, session);
  await roomManager.persistRoomState(session);
}

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    /**
     * join_room: { roomId, username, hostToken? }
     */
    socket.on("join_room", async (payload = {}) => {
      try {
        const roomId = String(payload.roomId || "").trim().toUpperCase();
        const username = String(payload.username || "").trim();
        const hostToken = payload.hostToken ? String(payload.hostToken).trim() : "";

        if (!roomId) {
          return emitError(socket, "Room code is required.");
        }
        if (!username || username.length < 2 || username.length > 40) {
          return emitError(socket, "Username must be between 2 and 40 characters.");
        }

        // Leave previous room if socket was already in one
        if (roomManager.getRoomBySocket(socket.id)) {
          await handleLeaveOrDisconnect(io, socket);
        }

        const session = await roomManager.getOrLoadRoom(roomId);
        if (!session) {
          return emitError(socket, `Room "${roomId}" does not exist.`);
        }

        const participant = session.addParticipant({
          socketId: socket.id,
          username,
          hostToken,
        });

        socket.join(session.roomId);
        roomManager.trackSocket(socket.id, session.roomId);

        const participants = session.getParticipantsList();
        const syncState = session.getSyncState();

        // Send complete initial state to joining client
        socket.emit("room_joined", {
          roomId: session.roomId,
          name: session.name,
          self: participant.toJSON(),
          syncState,
          participants,
          messages: session.messages,
          pendingRequests: participant.canControl() ? session.getPendingRequests() : [],
        });

        // Also send sync_state directly per spec
        socket.emit("sync_state", syncState);

        // Notify everyone in the room about the new participant
        io.to(session.roomId).emit("user_joined", {
          username: participant.username,
          userId: participant.userId,
          role: participant.role,
          participants,
        });
      } catch (error) {
        emitError(socket, error.message || "Failed to join room.");
      }
    });

    /**
     * leave_room: { roomId }
     */
    socket.on("leave_room", async () => {
      await handleLeaveOrDisconnect(io, socket);
    });

    /**
     * play: { time? } — Host / Moderator only
     */
    socket.on("play", async (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      if (!participant.canControl()) {
        return emitError(
          socket,
          "Only Host or Moderator can play the video. Submit a change request instead."
        );
      }

      const syncState = session.play(payload?.time);
      io.to(session.roomId).emit("sync_state", syncState);
      await roomManager.persistRoomState(session);
    });

    /**
     * pause: { time? } — Host / Moderator only
     */
    socket.on("pause", async (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      if (!participant.canControl()) {
        return emitError(
          socket,
          "Only Host or Moderator can pause the video. Submit a change request instead."
        );
      }

      const syncState = session.pause(payload?.time);
      io.to(session.roomId).emit("sync_state", syncState);
      await roomManager.persistRoomState(session);
    });

    /**
     * seek: { time } — Host / Moderator only
     */
    socket.on("seek", async (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      if (!participant.canControl()) {
        return emitError(
          socket,
          "Only Host or Moderator can seek the video. Submit a change request instead."
        );
      }

      const time = Number(payload?.time);
      if (!Number.isFinite(time) || time < 0) {
        return emitError(socket, "Seek time must be a valid non-negative number.");
      }

      const syncState = session.seek(time);
      io.to(session.roomId).emit("sync_state", syncState);
      await roomManager.persistRoomState(session);
    });

    /**
     * change_video: { videoId } (accepts URL or 11-char ID) — Host / Moderator only
     */
    socket.on("change_video", async (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      if (!participant.canControl()) {
        return emitError(
          socket,
          "Only Host or Moderator can change the video. Submit a change request instead."
        );
      }

      const parsedVideoId = extractYouTubeVideoId(String(payload?.videoId || ""));
      if (!parsedVideoId) {
        return emitError(socket, "Invalid YouTube URL or video ID.");
      }

      const syncState = session.changeVideo(parsedVideoId);
      io.to(session.roomId).emit("sync_state", syncState);
      await roomManager.persistRoomState(session);
    });

    /**
     * assign_role: { userId, role } — Host only
     */
    socket.on("assign_role", (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      if (!participant.isHost()) {
        return emitError(socket, "Only the Host can assign roles.");
      }

      const targetUserId = String(payload?.userId || "");
      const newRole = String(payload?.role || "");

      if (targetUserId === participant.userId) {
        return emitError(socket, "Use Transfer Host to pass the Host role to someone else.");
      }
      if (!isValidAssignableRole(newRole)) {
        return emitError(
          socket,
          `Invalid role "${newRole}". Allowed: ${ROLES.MODERATOR}, ${ROLES.PARTICIPANT}, ${ROLES.VIEWER}.`
        );
      }

      const updated = session.assignRole(targetUserId, newRole);
      if (!updated) {
        return emitError(socket, "Target participant not found.");
      }

      const participants = session.getParticipantsList();
      io.to(session.roomId).emit("role_assigned", {
        userId: updated.userId,
        username: updated.username,
        role: updated.role,
        participants,
      });

      emitPendingRequestsToControllers(io, session);
    });

    /**
     * remove_participant: { userId } — Host only
     */
    socket.on("remove_participant", (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      if (!participant.isHost()) {
        return emitError(socket, "Only the Host can remove participants.");
      }

      const targetUserId = String(payload?.userId || "");
      if (targetUserId === participant.userId) {
        return emitError(socket, "Host cannot remove themselves. Use Leave Room instead.");
      }

      const target = session.getParticipantById(targetUserId);
      if (!target) {
        return emitError(socket, "Participant not found in this room.");
      }

      const targetSocketId = target.socketId;
      session.removeParticipantById(targetUserId);
      roomManager.untrackSocket(targetSocketId);

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit("removed_from_room", {
          roomId: session.roomId,
          reason: "You were removed from the room by the Host.",
        });
        targetSocket.leave(session.roomId);
      }

      io.to(session.roomId).emit("participant_removed", {
        userId: targetUserId,
        username: target.username,
        participants: session.getParticipantsList(),
      });

      emitPendingRequestsToControllers(io, session);
    });

    /**
     * transfer_host: { userId } — Host only
     */
    socket.on("transfer_host", async (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      if (!participant.isHost()) {
        return emitError(socket, "Only the Host can transfer Host privileges.");
      }

      const targetUserId = String(payload?.userId || "");
      const result = session.transferHost(participant.userId, targetUserId);
      if (!result) {
        return emitError(socket, "Unable to transfer Host role to that participant.");
      }

      const participants = session.getParticipantsList();
      io.to(session.roomId).emit("role_assigned", {
        userId: result.newHost.userId,
        username: result.newHost.username,
        role: result.newHost.role,
        participants,
      });
      io.to(session.roomId).emit("host_transferred", {
        previousHostId: result.previousHost.userId,
        newHostId: result.newHost.userId,
        newHostUsername: result.newHost.username,
        participants,
      });

      await roomManager.persistRoomState(session);
    });

    /**
     * request_change: { action, payload }
     * Participants/Viewers request Host or Moderator approval for playback/video changes.
     */
    socket.on("request_change", (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      const action = String(payload?.action || "");
      if (!ALLOWED_REQUEST_ACTIONS.has(action)) {
        return emitError(socket, "Unsupported change request action.");
      }

      const requestPayload = {};
      if (action === "seek") {
        const time = Number(payload?.payload?.time);
        if (!Number.isFinite(time) || time < 0) {
          return emitError(socket, "Requested seek time must be a valid non-negative number.");
        }
        requestPayload.time = time;
      } else if (action === "change_video") {
        const videoId = extractYouTubeVideoId(String(payload?.payload?.videoId || ""));
        if (!videoId) {
          return emitError(socket, "Requested video must be a valid YouTube URL or ID.");
        }
        requestPayload.videoId = videoId;
      }

      const request = session.addChangeRequest({
        participant,
        action,
        payload: requestPayload,
      });

      socket.emit("change_request_submitted", { request });

      // Notify Host and Moderators
      for (const p of session.participants.values()) {
        if (p.canControl()) {
          io.to(p.socketId).emit("change_request_received", {
            request,
            requests: session.getPendingRequests(),
          });
        }
      }
    });

    /**
     * resolve_change_request: { requestId, approved } — Host / Moderator only
     */
    socket.on("resolve_change_request", async (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      if (!participant.canControl()) {
        return emitError(socket, "Only Host or Moderator can approve or reject requests.");
      }

      const requestId = String(payload?.requestId || "");
      const approved = Boolean(payload?.approved);

      const request = session.resolveChangeRequest(requestId);
      if (!request) {
        return emitError(socket, "Change request not found or already resolved.");
      }

      if (approved) {
        let syncState = null;
        if (request.action === "play") {
          syncState = session.play();
        } else if (request.action === "pause") {
          syncState = session.pause();
        } else if (request.action === "seek") {
          syncState = session.seek(request.payload.time);
        } else if (request.action === "change_video") {
          syncState = session.changeVideo(request.payload.videoId);
        }

        if (syncState) {
          io.to(session.roomId).emit("sync_state", syncState);
          await roomManager.persistRoomState(session);
        }
      }

      io.to(session.roomId).emit("change_request_resolved", {
        requestId: request.requestId,
        action: request.action,
        requestedBy: request.username,
        approved,
        resolvedBy: participant.username,
      });

      emitPendingRequestsToControllers(io, session);
    });

    /**
     * send_message: { text } — Any participant in the room
     */
    socket.on("send_message", async (payload = {}) => {
      const ctx = getAuthorizedContext(socket);
      if (!ctx) return;
      const { session, participant } = ctx;

      const text = String(payload?.text || "").trim();
      if (!text) return;
      if (text.length > 500) {
        return emitError(socket, "Message must be 500 characters or fewer.");
      }

      const message = session.addMessage({ participant, text });
      io.to(session.roomId).emit("new_message", message);
      await roomManager.persistRoomState(session);
    });

    socket.on("disconnect", async () => {
      await handleLeaveOrDisconnect(io, socket);
    });
  });
}

module.exports = { registerSocketHandlers };
