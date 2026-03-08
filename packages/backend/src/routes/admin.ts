import { Router } from "express";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { authenticate, requireRole } from "../middleware/auth";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

// ── Users ──────────────────────────────────────────────────────────────────

router.get("/users", authenticate, requireRole(Role.ADMIN, Role.SUPERVISOR), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.nativeEnum(Role),
});

router.post("/users", authenticate, requireRole(Role.ADMIN), async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }
  const { email, name, password, role } = result.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already exists" });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, password: hashed, role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  res.json(user);
});

router.patch("/users/:id/role", authenticate, requireRole(Role.ADMIN), async (req, res) => {
  const id = String(req.params.id);
  const { role } = req.body;
  if (!Object.values(Role).includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json(user);
});

router.delete("/users/:id", authenticate, requireRole(Role.ADMIN), async (req, res) => {
  const id = String(req.params.id);
  if (id === req.user!.userId) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
});

// ── Permissions ────────────────────────────────────────────────────────────

router.get("/permissions", authenticate, requireRole(Role.ADMIN, Role.SUPERVISOR), async (_req, res) => {
  const perms = await prisma.apiPermission.findMany({
    orderBy: [{ role: "asc" }, { api: "asc" }, { action: "asc" }],
  });
  res.json(perms);
});

router.patch("/permissions/:id", authenticate, requireRole(Role.ADMIN), async (req, res) => {
  const id = String(req.params.id);
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be boolean" });
    return;
  }
  const perm = await prisma.apiPermission.update({
    where: { id },
    data: { enabled },
  });
  res.json(perm);
});

export default router;
