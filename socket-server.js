// socket-server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Initialize Socket.IO with CORS enabled for your Next.js frontend
const io = new Server(server, {
  cors: {
    origin: "*", // In production, replace with your actual domain
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  // 1. Client joins their own private room based on User ID
  socket.on("join-room", (userId) => {
    socket.join(`user-${userId}`);
    console.log(`👤 User ${userId} connected to notifications.`);
  });

  socket.on("disconnect", () => {
    // console.log("Client disconnected");
  });
});

// 2. API Endpoint for Next.js to trigger events
app.post("/trigger-email", (req, res) => {
  // ✅ NOW ACCEPTS 'type' to differentiate between 'new-email' and 'email-sent'
  const { toIds, emailData, type } = req.body;

  if (!toIds || !emailData) {
    return res.status(400).send("Missing data");
  }

  // Default to 'new-email' if type is not provided
  const eventName = type || "new-email";

  // Emit event to specific users only
  toIds.forEach((userId) => {
    io.to(`user-${userId}`).emit(eventName, emailData);
  });

  console.log(`📨 Notification [${eventName}] sent to ${toIds.length} users.`);
  res.json({ success: true });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🟢 Socket Server running on port ${PORT}`);
});