import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middlewares/auth";

const prisma = new PrismaClient();

export const getFollowers = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const followers = await prisma.followers.findMany({
      where: {
        userId: userId,
        flag: 1,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(followers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengambil followers", error });
  }
};

export const getFollowing = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);

    const following = await prisma.followers.findMany({
      where: {
        userId: userId,
        flag: 2,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(following);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengambil following", error });
  }
};

export const unFollow = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.followers.delete({
      where: { id },
    });

    res.json({ message: "Unfollow berhasil" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal melakukan unfollow", error });
  }
};

export const getFollowCount = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);

    const followers = await prisma.followers.count({
      where: {
        userId: userId,
        flag: 1,
      },
    });

    const following = await prisma.followers.count({
      where: {
        userId,
        flag: 2,
      },
    });

    res.json({ totalFollowers: followers, totalFollowing: following });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil jumlah followers/following" });
  }
};

export const createFollowers = async (req: AuthRequest, res: Response) => {
  const { followId, userId } = req.body;

  if (userId === followId) {
    return res
      .status(400)
      .json({ message: "Kamu tidak bisa mengikuti dirimu sendiri" });
  }

  const cekFollowers = await prisma.followers.findFirst({
    where: { followId, userId, flag: 1 },
  });

  if (cekFollowers) {
    return res.json({ message: "gagal follow" });
  }

  try {
    const followers = await prisma.followers.create({
      data: {
        followId,
        userId,
        flag: 1,
      },
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
      data: {
        followId: followId,
        userId: userId,
        flag: 2,
      },
    });

    const cekFollowers = await prisma.followers.findFirst({
      where: { followId: userId, userId: followId, flag: 1 },
    });
    if (!cekFollowers) {
      const followers = await prisma.followers.create({
        data: {
          followId: userId,
          userId: followId,
          flag: 1,
        },
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

    return res
      .status(201)
      .json({ message: "Following created", following: following });
  } catch (err) {
    console.error("Gagal membuat following:", err);
    return res
      .status(500)
      .json({ message: "Failed to create following", error: err });
  }
};

export const getSuggestedUsers = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Ambil semua user yang **bukan** dirinya sendiri dan belum di-follow
    const following = await prisma.followers.findMany({
      where: {
        userId: userId,
        flag: 2, // mengikuti siapa saja
      },
      select: {
        followId: true,
      },
    });

    const followingIds = following.map((f) => f.followId);

    const suggestedUsers = await prisma.user.findMany({
      where: {
        id: {
          notIn: [...followingIds, userId], // bukan yang sudah difollow dan bukan diri sendiri
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
      take: 5, // misalnya ambil 5 saja
    });

    res.json(suggestedUsers);
  } catch (err) {
    console.error("Error fetching suggested users:", err);
    res.status(500).json({ message: "Failed to fetch suggested users" });
  }
};
