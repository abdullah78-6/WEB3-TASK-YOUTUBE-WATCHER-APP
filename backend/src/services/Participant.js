const { ROLES, canControlPlayback, canManageRoom } = require("../utils/roles");

class Participant {
  constructor({ userId, socketId, username, role = ROLES.PARTICIPANT }) {
    this.userId = userId;
    this.socketId = socketId;
    this.username = username;
    this.role = role;
    this.joinedAt = new Date().toISOString();
  }

  canControl() {
    return canControlPlayback(this.role);
  }

  isHost() {
    return canManageRoom(this.role);
  }

  setRole(newRole) {
    this.role = newRole;
  }

  toJSON() {
    return {
      userId: this.userId,
      username: this.username,
      role: this.role,
      joinedAt: this.joinedAt,
    };
  }
}

module.exports = Participant;
