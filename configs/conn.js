const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const url = process.env.MONGODB_URI;

    if (!url) {
      throw new Error("MONGODB_URI is not defined");
    }

    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    const conn = await mongoose.connect(url);

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    return conn.connection;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = connectDB;
