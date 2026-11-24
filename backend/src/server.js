require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const { createApp } = require("./app");
const { connectDB } = require("./config/db");
const { registerSocketHandlers } = require("./controllers/socketController");

const PORT=5000;
const MONGO_URI = "mongodb+srv://greatstack:123456abdullah@cluster0.siw3vfv.mongodb.net/YOUTUBE-WATCH-PARTY";
const CLIENT_ORIGIN = "http://localhost:5173" || "*";

async function startServer() {
  if (MONGO_URI) {
    try {
      await connectDB(MONGO_URI);
    } catch {
      console.warn(
        "[Server] Continuing without MongoDB persistence. Start MongoDB or update MONGO_URI in .env to enable persistence."
      );
    }
  } else {
    console.warn("[Server] MONGO_URI not configured. Running with in-memory room state.");
  }

  const app = createApp(CLIENT_ORIGIN);
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: CLIENT_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  registerSocketHandlers(io);

  httpServer.listen(PORT, () => {
    console.log(`[Server] YouTube Watch Party backend running on http://localhost:${PORT}`);
  });
}

startServer();
