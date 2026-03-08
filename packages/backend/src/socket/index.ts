import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { AuthPayload } from "../middleware/auth";
import { runHrAgent } from "../agents/hrAgent";

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  user?: AuthPayload;
}

export function setupSocketHandlers(io: Server) {
  // JWT authentication middleware for sockets
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      socket.user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    console.log(`[Socket] Connected: ${user.name} (${user.role})`);

    // Join role-based rooms for broadcast targeting
    if (user.role === "OPERATOR" || user.role === "SUPERVISOR" || user.role === "ADMIN") {
      socket.join("operators");
    }
    if (user.role === "SUPERVISOR" || user.role === "ADMIN") {
      socket.join("monitor");
    }

    // ── Join a chat room ───────────────────────────────────────────────────
    socket.on("room:join", async ({ roomId }: { roomId: string }) => {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) return;

      socket.join(`room:${roomId}`);

      // If operator/supervisor joining, add as member
      if (user.role !== "USER") {
        await prisma.roomMember.upsert({
          where: { roomId_userId: { roomId, userId: user.userId } },
          update: {},
          create: { roomId, userId: user.userId },
        });
        // Notify room
        io.to(`room:${roomId}`).emit("room:member_joined", {
          user: { id: user.userId, name: user.name, role: user.role },
        });
      }

      console.log(`[Socket] ${user.name} joined room:${roomId}`);
    });

    // ── Leave a chat room ──────────────────────────────────────────────────
    socket.on("room:leave", ({ roomId }: { roomId: string }) => {
      socket.leave(`room:${roomId}`);
    });

    // ── Send a message ─────────────────────────────────────────────────────
    socket.on(
      "message:send",
      async ({ roomId, content }: { roomId: string; content: string }) => {
        if (!content?.trim()) return;

        // Check membership
        const member = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId: user.userId } },
        });
        if (!member && user.role === "USER") return;

        // Save message
        const message = await prisma.message.create({
          data: {
            roomId,
            userId: user.userId,
            senderName: user.name,
            content: content.trim(),
            type: "TEXT",
          },
        });

        // Broadcast to room
        io.to(`room:${roomId}`).emit("message:new", {
          ...message,
          user: { id: user.userId, name: user.name, role: user.role },
        });

        // Detect /hr command
        const hrMatch = content.match(/^\/hr\s*([\s\S]*)/i);
        if (hrMatch) {
          const agentQuery = hrMatch[1].trim() || content;
          // Run agent asynchronously
          runHrAgent({
            roomId,
            userMessage: agentQuery || content,
            userId: user.userId,
            userEmail: user.email,
            userRole: user.role,
            io,
          }).catch((err) => {
            console.error("[Socket] Agent error:", err);
            io.to(`room:${roomId}`).emit("agent:error", {
              error: "エージェントの処理中にエラーが発生しました",
            });
          });
        }
      }
    );

    // ── Operator join room (escalation response) ───────────────────────────
    socket.on(
      "operator:join_room",
      async ({ roomId }: { roomId: string }) => {
        if (user.role === "USER") return;

        socket.join(`room:${roomId}`);
        await prisma.roomMember.upsert({
          where: { roomId_userId: { roomId, userId: user.userId } },
          update: {},
          create: { roomId, userId: user.userId },
        });

        const sysMsg = await prisma.message.create({
          data: {
            roomId,
            senderName: "システム",
            content: `👤 ${user.name}（${roleLabel(user.role)}）がチャットに参加しました`,
            type: "SYSTEM",
          },
        });

        io.to(`room:${roomId}`).emit("message:new", sysMsg);
        io.to(`room:${roomId}`).emit("room:member_joined", {
          user: { id: user.userId, name: user.name, role: user.role },
        });

        console.log(`[Socket] Operator ${user.name} joined room:${roomId}`);
      }
    );

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${user.name}`);
    });
  });
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    OPERATOR: "オペレータ",
    SUPERVISOR: "スーパーバイザー",
    ADMIN: "管理者",
  };
  return labels[role] ?? role;
}
