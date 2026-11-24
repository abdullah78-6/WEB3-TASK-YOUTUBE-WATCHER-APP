const crypto = require("crypto");
const Room = require("../models/Room");
const { isDbConnected } = require("../config/db");
const RoomSession = require("./RoomSession");

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

class RoomManager {
  constructor() {
    /** @type {Map<string, RoomSession>} keyed by uppercase roomId */
    this.rooms = new Map();
    /** @type {Map<string, string>} socketId -> roomId */
    this.socketRoomMap = new Map();
  }

  async createRoom({ name, hostUsername, videoId }) {
    let roomId = generateRoomCode();
    while (this.rooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    const hostToken = crypto.randomBytes(16).toString("hex");
    const session = new RoomSession({
      roomId,
      name: name || `${hostUsername}'s Watch Party`,
      hostUsername,
      hostToken,
      videoId: videoId || "dQw4w9WgXcQ",
    });

    this.rooms.set(roomId, session);

    if (isDbConnected()) {
      await Room.create({
        roomId: session.roomId,
        name: session.name,
        hostUsername: session.hostUsername,
        hostToken: session.hostToken,
        videoId: session.videoId,
        playState: session.playState,
        currentTime: session.currentTime,
        lastStateUpdatedAt: new Date(session.lastStateUpdatedAt),
        messages: [],
      });
    }

    return session;
  }

  async getOrLoadRoom(roomId) {
    const normalizedId = String(roomId || "").trim().toUpperCase();
    if (!normalizedId) return null;

    if (this.rooms.has(normalizedId)) {
      return this.rooms.get(normalizedId);
    }

    if (isDbConnected()) {
      const doc = await Room.findOne({ roomId: normalizedId }).lean();
      if (doc) {
        const session = new RoomSession({
          roomId: doc.roomId,
          name: doc.name,
          hostUsername: doc.hostUsername,
          hostToken: doc.hostToken,
          videoId: doc.videoId,
          playState: doc.playState,
          currentTime: doc.currentTime,
          lastStateUpdatedAt: doc.lastStateUpdatedAt,
          messages: doc.messages || [],
        });
        this.rooms.set(normalizedId, session);
        return session;
      }
    }

    return null;
  }

  async persistRoomState(session) {
    if (!isDbConnected() || !session) return;
    try {
      await Room.findOneAndUpdate(
        { roomId: session.roomId },
        {
          name: session.name,
          hostUsername: session.hostUsername,
          videoId: session.videoId,
          playState: session.playState,
          currentTime: session.currentTime,
          lastStateUpdatedAt: new Date(session.lastStateUpdatedAt),
          messages: session.messages.slice(-100),
        },
        { upsert: true }
      );
    } catch (err) {
      console.error(`[RoomManager] Failed to persist room ${session.roomId}:`, err.message);
    }
  }

  trackSocket(socketId, roomId) {
    this.socketRoomMap.set(socketId, roomId.toUpperCase());
  }

  untrackSocket(socketId) {
    const roomId = this.socketRoomMap.get(socketId);
    this.socketRoomMap.delete(socketId);
    return roomId || null;
  }

  getRoomBySocket(socketId) {
    const roomId = this.socketRoomMap.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  listActiveRooms() {
    return Array.from(this.rooms.values()).map((room) => ({
      roomId: room.roomId,
      name: room.name,
      hostUsername: room.hostUsername,
      videoId: room.videoId,
      playState: room.playState,
      participantCount: room.participants.size,
    }));
  }
}

module.exports = new RoomManager();
