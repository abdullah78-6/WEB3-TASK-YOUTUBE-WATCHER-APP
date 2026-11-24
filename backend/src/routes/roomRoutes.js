const express = require("express");
const { createRoom, getRoom, listRooms } = require("../controllers/roomController");

const router = express.Router();

router.get("/", listRooms);
router.post("/", createRoom);
router.get("/:roomId", getRoom);

module.exports = router;
