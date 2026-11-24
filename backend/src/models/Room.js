const mongoose = require("mongoose");
const { ROLES } = require("../utils/roles");

const messageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.PARTICIPANT },
    text: { type: String, required: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    hostUsername: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    hostToken: {
      type: String,
      required: true,
    },
    videoId: {
      type: String,
      default: "dQw4w9WgXcQ",
    },
    playState: {
      type: String,
      enum: ["playing", "paused"],
      default: "paused",
    },
    currentTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastStateUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
