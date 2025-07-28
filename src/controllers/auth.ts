import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import session from "express-session";
import path from "path";
import fs from "fs";
import { AuthRequest } from "../middlewares/auth";

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
      res.status(400).json({ message: "Email already used" });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const avatar = req.file ? `/uploads/avatars/${req.file.filename}` : null;

    const user = await prisma.user.create({
      data: { name, email, password: hashed, avatar },
    });

    {
      res.status(201).json({ message: "Register successful", user });
      return;
    }
  } catch (err) {
    res.status(500).json({ message: "Register failed", error: err });
    return;
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
  const user = await prisma.user.findUnique({ where: { id: userId } });
  res.json(user);
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
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

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId; // pastikan pakai userId dari middleware

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { name } = req.body;
    const avatarFile = req.file;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let avatarPath = user.avatar;

    if (avatarFile) {
      // Hapus avatar lama jika ada
      if (avatarPath) {
        const oldPath = path.join(__dirname, "..", avatarPath);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (err) {
            console.error("Gagal hapus avatar lama:", err);
          }
        }
      }

      // Simpan path baru
      avatarPath = `/uploads/avatars/${avatarFile.filename}`;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || user.name,
        avatar: avatarPath,
      },
    });

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  const nameQuery = req.query.name as string;

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

    res.json(users);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Failed to search users" });
  }
};
