

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let activeUsers = [];

io.on("connection", (socket) => {
  socket.emit("me", socket.id);

  activeUsers.push(socket.id);
  io.emit("activeUsers", activeUsers);

  socket.on("call", ({ offer, to }) => {
    io.to(to).emit("incomingCall", { offer, from: socket.id });
  });

  socket.on("answer", ({ answer, to }) => {
    console.log("answer", answer, "to:", to);
    io.emit("callAccepted", { answer });
  });

  socket.on("candidate", ({ candidate, to }) => {
    io.to(to).emit("candidate", candidate);
  });

  socket.on("disconnect", () => {
    activeUsers = activeUsers.filter((id) => id !== socket.id);
    io.emit("activeUsers", activeUsers);
  });
});

server.listen(7000, () => {
  console.log("Server running on port 7000");
});
