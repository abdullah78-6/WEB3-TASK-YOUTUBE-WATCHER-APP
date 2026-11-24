const express = require("express");
const cors = require("cors");
const roomRoutes = require("./routes/roomRoutes");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");
const { isDbConnected } = require("./config/db");

function createApp(clientOrigin) {
  const app = express();

  app.use(
    cors({
      origin: clientOrigin || "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      database: isDbConnected() ? "connected" : "in-memory",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/rooms", roomRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
