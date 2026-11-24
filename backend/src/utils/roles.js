const ROLES = Object.freeze({
  HOST: "Host",
  MODERATOR: "Moderator",
  PARTICIPANT: "Participant",
  VIEWER: "Viewer",
});

const CONTROL_ROLES = new Set([ROLES.HOST, ROLES.MODERATOR]);
const ASSIGNABLE_ROLES = new Set([ROLES.MODERATOR, ROLES.PARTICIPANT, ROLES.VIEWER]);

function canControlPlayback(role) {
  return CONTROL_ROLES.has(role);
}

function canManageRoom(role) {
  return role === ROLES.HOST;
}

function isValidAssignableRole(role) {
  return ASSIGNABLE_ROLES.has(role);
}

module.exports = {
  ROLES,
  canControlPlayback,
  canManageRoom,
  isValidAssignableRole,
};
