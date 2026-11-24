const mongoose = require("mongoose");

let isConnected = false;

async function connectDB(mongoUri) {
  if (!mongoUri) {
    console.warn("[DB] MONGO_URI not set. Running in in-memory mode.");
    return false;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[DB] Connected to MongoDB: ${mongoose.connection.host}`);
    return true;
  } catch (error) {
    isConnected = false;
    console.error(`[DB] MongoDB connection error: ${error.message}`);
    throw error;
  }
}

function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDbConnected };
