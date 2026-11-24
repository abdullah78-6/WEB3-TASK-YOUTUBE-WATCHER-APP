const crypto = require("crypto");
const { ROLES } = require("../utils/roles");
const Participant = require("./Participant");

class RoomSession {
  constructor({
    roomId,
    name = "Watch Party",
    hostUsername = "",
    hostToken = "",
    videoId = "dQw4w9WgXcQ",
    playState = "paused",
    currentTime = 0,
    lastStateUpdatedAt = Date.now(),
    messages = [],
  }) {
    this.roomId = roomId.toUpperCase();
    this.name = name;
    this.hostUsername = hostUsername;
    this.hostToken = hostToken;
    this.videoId = videoId;
    this.playState = playState;
    this.currentTime = Number(currentTime) || 0;
    this.lastStateUpdatedAt =
      typeof lastStateUpdatedAt === "number"
        ? lastStateUpdatedAt
        : new Date(lastStateUpdatedAt).getTime();

    /** @type {Map<string, Participant>} keyed by userId */
    this.participants = new Map();
    /** @type {Map<string, string>} socketId -> userId */
    this.socketToUser = new Map();
    /** @type {Array<object>} */
    this.messages = Array.isArray(messages) ? [...messages].slice(-100) : [];
    /** @type {Map<string, object>} pending change requests keyed by requestId */
    this.pendingRequests = new Map();
  }

  /**
   * Returns drift-corrected playback time when the video is currently playing.
   */
  getLiveCurrentTime() {
    if (this.playState === "playing") {
      const elapsedSeconds = Math.max(0, (Date.now() - this.lastStateUpdatedAt) / 1000);
      return Number((this.currentTime + elapsedSeconds).toFixed(2));
    }
    return Number(this.currentTime.toFixed(2));
  }

  getSyncState() {
    return {
      roomId: this.roomId,
      name: this.name,
      videoId: this.videoId,
      playState: this.playState,
      currentTime: this.getLiveCurrentTime(),
      updatedAt: Date.now(),
    };
  }

  getParticipantsList() {
    const rolePriority = {
      [ROLES.HOST]: 0,
      [ROLES.MODERATOR]: 1,
      [ROLES.PARTICIPANT]: 2,
      [ROLES.VIEWER]: 3,
    };
    return Array.from(this.participants.values())
      .map((p) => p.toJSON())
      .sort((a, b) => (rolePriority[a.role] ?? 9) - (rolePriority[b.role] ?? 9));
  }

  hasHost() {
    for (const participant of this.participants.values()) {
      if (participant.role === ROLES.HOST) return true;
    }
    return false;
  }

  addParticipant({ socketId, username, hostToken }) {
    const existingUserId = this.socketToUser.get(socketId);
    if (existingUserId && this.participants.has(existingUserId)) {
      return this.participants.get(existingUserId);
    }

    const userId = crypto.randomBytes(6).toString("hex");
    const isVerifiedCreator = Boolean(this.hostToken && hostToken && hostToken === this.hostToken);
    const shouldBeHost = isVerifiedCreator || (!this.hasHost() && this.participants.size === 0 && !this.hostToken);

    // If the verified creator rejoins, demote any temporary host back to Moderator
    if (isVerifiedCreator) {
      for (const p of this.participants.values()) {
        if (p.role === ROLES.HOST) {
          p.setRole(ROLES.MODERATOR);
        }
      }
    }

    const role = shouldBeHost ? ROLES.HOST : ROLES.PARTICIPANT;
    const participant = new Participant({ userId, socketId, username, role });

    this.participants.set(userId, participant);
    this.socketToUser.set(socketId, userId);

    if (role === ROLES.HOST) {
      this.hostUsername = username;
    }

    return participant;
  }

  getParticipantBySocket(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return null;
    return this.participants.get(userId) || null;
  }

  getParticipantById(userId) {
    return this.participants.get(userId) || null;
  }

  removeParticipantById(userId) {
    const participant = this.participants.get(userId);
    if (!participant) return { removed: null, promotedHost: null };

    this.participants.delete(userId);
    this.socketToUser.delete(participant.socketId);

    // Remove any pending requests created by this user
    for (const [reqId, req] of this.pendingRequests.entries()) {
      if (req.userId === userId) {
        this.pendingRequests.delete(reqId);
      }
    }

    // If Host left and participants remain, promote a Moderator first, otherwise earliest joiner
    let promotedHost = null;
    if (participant.role === ROLES.HOST && this.participants.size > 0) {
      const remaining = Array.from(this.participants.values());
      const nextHost =
        remaining.find((p) => p.role === ROLES.MODERATOR) || remaining[0];
      if (nextHost) {
        nextHost.setRole(ROLES.HOST);
        this.hostUsername = nextHost.username;
        promotedHost = nextHost;
      }
    }

    return { removed: participant, promotedHost };
  }

  removeParticipantBySocket(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return { removed: null, promotedHost: null };
    return this.removeParticipantById(userId);
  }

  play(time) {
    if (typeof time === "number" && Number.isFinite(time) && time >= 0) {
      this.currentTime = time;
    } else {
      this.currentTime = this.getLiveCurrentTime();
    }
    this.playState = "playing";
    this.lastStateUpdatedAt = Date.now();
    return this.getSyncState();
  }

  pause(time) {
    if (typeof time === "number" && Number.isFinite(time) && time >= 0) {
      this.currentTime = time;
    } else {
      this.currentTime = this.getLiveCurrentTime();
    }
    this.playState = "paused";
    this.lastStateUpdatedAt = Date.now();
    return this.getSyncState();
  }

  seek(time) {
    const safeTime = Math.max(0, Number(time) || 0);
    this.currentTime = safeTime;
    this.lastStateUpdatedAt = Date.now();
    return this.getSyncState();
  }

  changeVideo(videoId) {
    this.videoId = videoId;
    this.currentTime = 0;
    this.playState = "paused";
    this.lastStateUpdatedAt = Date.now();
    return this.getSyncState();
  }

  assignRole(targetUserId, newRole) {
    const target = this.participants.get(targetUserId);
    if (!target) return null;
    target.setRole(newRole);
    return target;
  }

  transferHost(currentHostId, targetUserId) {
    const currentHost = this.participants.get(currentHostId);
    const target = this.participants.get(targetUserId);
    if (!currentHost || !target || currentHost.userId === target.userId) {
      return null;
    }
    currentHost.setRole(ROLES.MODERATOR);
    target.setRole(ROLES.HOST);
    this.hostUsername = target.username;
    return { previousHost: currentHost, newHost: target };
  }

  addChangeRequest({ participant, action, payload }) {
    const requestId = crypto.randomBytes(6).toString("hex");
    const request = {
      requestId,
      userId: participant.userId,
      username: participant.username,
      action,
      payload: payload || {},
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.pendingRequests.set(requestId, request);
    return request;
  }

  getPendingRequests() {
    return Array.from(this.pendingRequests.values());
  }

  resolveChangeRequest(requestId) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return null;
    this.pendingRequests.delete(requestId);
    return request;
  }

  addMessage({ participant, text }) {
    const message = {
      id: crypto.randomBytes(6).toString("hex"),
      userId: participant.userId,
      username: participant.username,
      role: participant.role,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    this.messages.push(message);
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100);
    }
    return message;
  }
}

module.exports = RoomSession;
