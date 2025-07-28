import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middlewares/auth";
import redis from "../lib/redis";

const prisma = new PrismaClient();
const CACHE_TTL = 60 * 5; // 5 minutes

export const getFollowers = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  const cacheKey = `followers:${userId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const followers = await prisma.followers.findMany({
      where: { userId, flag: 1 },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    await redis.set(cacheKey, JSON.stringify(followers), "EX", CACHE_TTL);
    res.json(followers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengambil followers", error });
  }
};

export const getFollowing = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  const cacheKey = `following:${userId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const following = await prisma.followers.findMany({
      where: { userId, flag: 2 },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    await redis.set(cacheKey, JSON.stringify(following), "EX", CACHE_TTL);
    res.json(following);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengambil following", error });
  }
};

export const getFollowCount = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  const cacheKey = `followCount:${userId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const [followers, following] = await Promise.all([
      prisma.followers.count({ where: { userId, flag: 1 } }),
      prisma.followers.count({ where: { userId, flag: 2 } }),
    ]);

    const data = { totalFollowers: followers, totalFollowing: following };
    await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL);

    res.json(data);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Gagal mengambil jumlah followers/following", error });
  }
};

export const unFollow = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    const followRecord = await prisma.followers.findUnique({ where: { id } });
    if (!followRecord)
      return res.status(404).json({ message: "Data follow tidak ditemukan" });

    await prisma.followers.delete({ where: { id } });

    // Invalidate both users' follow caches
    await redis.del(
      `followers:${followRecord.userId}`,
      `following:${followRecord.userId}`,
      `followCount:${followRecord.userId}`,
      `suggested:${followRecord.userId}`
    );

    res.json({ message: "Unfollow berhasil" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal melakukan unfollow", error });
  }
};

export const createFollowers = async (req: AuthRequest, res: Response) => {
  const { followId, userId } = req.body;

  if (userId === followId) {
    return res
      .status(400)
      .json({ message: "Kamu tidak bisa mengikuti dirimu sendiri" });
  }

  try {
    const existing = await prisma.followers.findFirst({
      where: { followId, userId, flag: 1 },
    });

    if (existing) return res.json({ message: "Sudah mengikuti" });

    const followers = await prisma.followers.create({
      data: { followId, userId, flag: 1 },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const io = req.app.get("io");
    io.emit("newFollow", followers);

    const targetUserRoom = `user-${followId}`;
    io.to(targetUserRoom).emit("followNotification", {
      fromUserId: userId,
      fromUserName: user?.name || "Seseorang",
      message: "Kamu punya pengikut baru!",
    });

    // Invalidate related caches
    await redis.del(
      `followers:${followId}`,
      `followCount:${followId}`,
      `suggested:${userId}`
    );

    return res.status(201).json({ message: "Followed", followers });
  } catch (err) {
    console.error("Gagal mengikuti:", err);
    return res.status(500).json({ message: "Failed to follow", error: err });
  }
};

export const createFollowing = async (req: AuthRequest, res: Response) => {
  const { followId, userId } = req.body;

  try {
    const following = await prisma.followers.create({
      data: { followId, userId, flag: 2 },
    });

    const cekFollowers = await prisma.followers.findFirst({
      where: { followId: userId, userId: followId, flag: 1 },
    });

    if (!cekFollowers) {
      await prisma.followers.create({
        data: { followId: userId, userId: followId, flag: 1 },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const io = req.app.get("io");
    io.emit("newFollow", following);

    const targetUserRoom = `user-${followId}`;
    io.to(targetUserRoom).emit("followNotification", {
      fromUserId: userId,
      fromUserName: user?.name || "Seseorang",
      message: "Kamu punya pengikut baru!",
    });

    await redis.del(
      `following:${userId}`,
      `followers:${followId}`,
      `followCount:${userId}`,
      `followCount:${followId}`,
      `suggested:${userId}`
    );

    return res.status(201).json({ message: "Following created", following });
  } catch (err) {
    console.error("Gagal membuat following:", err);
    return res
      .status(500)
      .json({ message: "Failed to create following", error: err });
  }
};

export const getSuggestedUsers = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  const cacheKey = `suggested:${userId}`;

  if (isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const following = await prisma.followers.findMany({
      where: { userId, flag: 2 },
      select: { followId: true },
    });

    const followingIds = following.map((f) => f.followId);

    const suggestedUsers = await prisma.user.findMany({
      where: {
        id: {
          notIn: [...followingIds, userId],
        },
      },
      select: { id: true, name: true, email: true, avatar: true },
      take: 5,
    });

    await redis.set(cacheKey, JSON.stringify(suggestedUsers), "EX", CACHE_TTL);
    res.json(suggestedUsers);
  } catch (err) {
    console.error("Error fetching suggested users:", err);
    res.status(500).json({ message: "Failed to fetch suggested users" });
  }
};
