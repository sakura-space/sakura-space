import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// List rooms for current user
router.get("/", authenticate, async (req, res) => {
  const rooms = await prisma.room.findMany({
    where: {
      members: { some: { userId: req.user!.userId } },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, role: true } } } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      agentSessions: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(rooms);
});

// Get all rooms (operators/admins)
router.get("/all", authenticate, async (req, res) => {
  const role = req.user!.role;
  if (role === "USER") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rooms = await prisma.room.findMany({
    include: {
      members: { include: { user: { select: { id: true, name: true, role: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      agentSessions: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(rooms);
});

// Create room
router.post("/", authenticate, async (req, res) => {
  const { name } = req.body;
  const room = await prisma.room.create({
    data: {
      name: name ?? null,
      members: { create: { userId: req.user!.userId } },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, role: true } } } },
    },
  });
  res.json(room);
});

// Get single room with messages
router.get("/:roomId", authenticate, async (req, res) => {
  const roomId = String(req.params.roomId);
  const role = req.user!.role;
  const userId = req.user!.userId;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: { include: { user: { select: { id: true, name: true, role: true } } } },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      agentSessions: true,
    },
  });

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const isMember = room.members.some((m: { userId: string }) => m.userId === userId);
  if (!isMember && role === "USER") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(room);
});

// Join room (operators)
router.post("/:roomId/join", authenticate, async (req, res) => {
  const roomId = String(req.params.roomId);
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role === "USER") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId, userId } },
    update: {},
    create: { roomId, userId },
  });
  res.json({ ok: true });
});

export default router;
