const roomManager = require("../services/RoomManager");
const { extractYouTubeVideoId } = require("../utils/youtube");

const DEFAULT_VIDEO_ID = "jfKfPfyJRdk";

/**
 * POST /api/rooms
 * Creates a new Watch Party room and returns the room metadata + hostToken for the creator.
 */
async function createRoom(req, res, next) {
  try {
    const { name, username, videoUrl } = req.body || {};
    const cleanUsername = String(username || "").trim();

    if (!cleanUsername || cleanUsername.length < 2 || cleanUsername.length > 40) {
      return res.status(400).json({
        error: "Username must be between 2 and 40 characters.",
      });
    }

    let videoId = DEFAULT_VIDEO_ID;
    if (videoUrl && String(videoUrl).trim()) {
      const parsedId = extractYouTubeVideoId(String(videoUrl));
      if (!parsedId) {
        return res.status(400).json({
          error: "Please provide a valid YouTube URL or 11-character video ID.",
        });
      }
      videoId = parsedId;
    }

    const cleanName = String(name || "").trim().slice(0, 80) || `${cleanUsername}'s Watch Party`;

    const session = await roomManager.createRoom({
      name: cleanName,
      hostUsername: cleanUsername,
      videoId,
    });

    return res.status(201).json({
      roomId: session.roomId,
      name: session.name,
      videoId: session.videoId,
      hostToken: session.hostToken,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/rooms/:roomId
 * Returns public metadata for an existing room (without exposing hostToken).
 */
async function getRoom(req, res, next) {
  try {
    const { roomId } = req.params;
    const session = await roomManager.getOrLoadRoom(roomId);

    if (!session) {
      return res.status(404).json({ error: "Room not found. Please check the room code." });
    }

    return res.json({
      roomId: session.roomId,
      name: session.name,
      hostUsername: session.hostUsername,
      videoId: session.videoId,
      playState: session.playState,
      currentTime: session.getLiveCurrentTime(),
      participantCount: session.participants.size,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/rooms
 * Lists currently active rooms.
 */
function listRooms(_req, res) {
  return res.json({ rooms: roomManager.listActiveRooms() });
}

module.exports = {
  createRoom,
  getRoom,
  listRooms,
};
