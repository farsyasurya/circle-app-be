import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import session from "express-session";
import path from "path";
import fs from "fs";
import { AuthRequest } from "../middlewares/auth";
import redis from "../lib/redis";

declare module "express-session" {
  interface SessionData {
    token?: string;
  }
}

dotenv.config();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  try {
    const exist = await prisma.user.findUnique({ where: { email } });
    if (exist) {
      return res.status(400).json({ message: "Email already used" });
    }

    const hashed = await bcrypt.hash(password, 10);

    // ✅ Ambil URL dari Cloudinary
    const avatar = req.file ? req.file.path : null;

    const user = await prisma.user.create({
      data: { name, email, password: hashed, avatar },
    });

    return res.status(201).json({ message: "Register successful", user });
  } catch (err) {
    console.error("Register failed:", err);
    return res.status(500).json({ message: "Register failed", error: err });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Wrong password" });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
    });

    req.session.token = token;

    res.json({
      message: "Login success",
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
    return;
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err });
    return;
  }
};

export const logout = (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Logout gagal" });
    }

    res.clearCookie("connect.sid");
    return res.json({ success: true, message: "Logout berhasil" });
  });
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  // Cek cache dulu
  const cached = await redis.get(`user:profile:${userId}`);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
  });

  if (!user) return res.status(404).json({ message: "User not found" });

  // Simpan ke Redis 5 menit
  await redis.set(`user:profile:${userId}`, JSON.stringify(user), "EX", 60 * 5);

  res.json(user);
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const cached = await redis.get(`user:profile:${userId}`);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        posts: {
          include: {
            _count: {
              select: { likes: true, comments: true },
            },
          },
        },
        comments: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hitung followers (orang yang follow dia)
    const followersCount = await prisma.followers.count({
      where: { followId: userId, flag: 1 },
    });

    // Hitung following (dia follow siapa saja)
    const followingCount = await prisma.followers.count({
      where: { userId: userId, flag: 2 },
    });
    await redis.set(
      `user:profile:${userId}`,
      JSON.stringify(user),
      "EX",
      60 * 5
    );

    res.json({
      ...user,
      followersCount,
      followingCount,
      postsCount: user.posts.length,
    });
  } catch (err) {
    console.error("Error getting user by ID:", err);
    res.status(500).json({ message: "Failed to get user by ID" });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    console.log("=== UPDATE PROFILE ===");
    console.log("req.user", (req as any).user);
    console.log("req.body", req.body);
    console.log("req.file", req.file);

    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { name } = req.body;
    const avatarFile = req.file;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ambil path Cloudinary jika ada
    const avatarPath = avatarFile?.path || user.avatar;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || user.name,
        avatar: avatarPath,
      },
    });

    // Hapus cache Redis
    await redis.del(`user:profile:${userId}`);

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("Update error:", err);
    console.error("Full error object:", JSON.stringify(err, null, 2));
    res
      .status(500)
      .json({ message: "Failed to update profile", error: err.message });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  const nameQuery = req.query.name as string;

  const cached = await redis.get(`user:profile:${nameQuery}`);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        name: {
          contains: nameQuery,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });
    await redis.set(
      `user:profile:${nameQuery}`,
      JSON.stringify(nameQuery),
      "EX",
      60 * 5
    );

    res.json(users);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Failed to search users" });
  }
};
