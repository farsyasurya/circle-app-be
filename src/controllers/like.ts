import { Request, Response } from "express";
import { AuthRequest } from "../types/auth";
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();
// 1. Like post
export const likePost = async (req: AuthRequest, res: Response) => {
  console.log("USER FROM TOKEN:", req.user); 
  const userId = req.user?.userId;
  const postId = Number(req.params.postId);

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const existingLike = await prisma.like.findFirst({
      where: { userId, postId },
    });

    if (existingLike) {
      return res.status(400).json({ message: "You already liked this post" });
    }

    const like = await prisma.like.create({
      data: { userId, postId },
    });

    res.status(201).json({ message: "Liked", like });
  } catch (error) {
    res.status(500).json({ message: "Failed to like post", error });
  }
};

// 2. Unlike post
export const unlikePost = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const postId = Number(req.params.postId);

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const existingLike = await prisma.like.findFirst({
      where: { userId, postId },
    });

    if (!existingLike) {
      return res.status(404).json({ message: "Like not found" });
    }

    await prisma.like.delete({
      where: { id: existingLike.id },
    });

    res.json({ message: "Unliked" });
  } catch (error) {
    res.status(500).json({ message: "Failed to unlike post", error });
  }
};

// 3. Get all likes for a post
export const getLikesByPost = async (req: Request, res: Response) => {
  const postId = Number(req.params.postId);

  try {
    const likes = await prisma.like.findMany({
      where: { postId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    res.json(likes);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch likes", error });
  }
};
