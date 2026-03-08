import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { config } from "./config";
import authRouter from "./routes/auth";
import roomsRouter from "./routes/rooms";
import adminRouter from "./routes/admin";
import { setupSocketHandlers } from "./socket";

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.frontendUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/admin", adminRouter);

// Socket.io
setupSocketHandlers(io);

httpServer.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  console.log(`🤖 HR Agent ready (model: claude-opus-4-6)`);
});
