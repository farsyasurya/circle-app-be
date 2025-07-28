import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middlewares/auth";
import redis from "../lib/redis";

const prisma = new PrismaClient();
const COMMENT_CACHE_PREFIX = "comments:post";
const CACHE_TTL = 60 * 5; // 5 minutes

export const createComment = async (req: AuthRequest, res: Response) => {
  const { postId, content } = req.body;

  if (!content || !postId) {
    return res.status(400).json({ message: "PostId dan content wajib diisi" });
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        content,
        postId: Number(postId),
        userId: req.user!.userId,
      },
    });

    // Invalidate cache
    await redis.del(`${COMMENT_CACHE_PREFIX}:${postId}`);

    res.status(201).json(comment);
  } catch (err) {
    console.error("Error createComment:", err);
    res.status(500).json({ message: "Gagal membuat komentar", error: err });
  }
};

export const getCommentsByPost = async (req: Request, res: Response) => {
  const { postId } = req.params;

  try {
    const cacheKey = `${COMMENT_CACHE_PREFIX}:${postId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const comments = await prisma.comment.findMany({
      where: { postId: Number(postId) },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    await redis.set(cacheKey, JSON.stringify(comments), "EX", CACHE_TTL);

    res.json(comments);
  } catch (err) {
    console.error("Error getCommentsByPost:", err);
    res.status(500).json({ message: "Gagal mengambil komentar", error: err });
  }
};

export const updateComment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: Number(id) },
    });

    if (!comment) {
      return res.status(404).json({ message: "Komentar tidak ditemukan" });
    }

    if (comment.userId !== req.user?.userId) {
      return res
        .status(403)
        .json({ message: "Kamu tidak boleh mengedit komentar ini" });
    }

    const updated = await prisma.comment.update({
      where: { id: Number(id) },
      data: { content },
    });

    // Invalidate cache
    await redis.del(`${COMMENT_CACHE_PREFIX}:${comment.postId}`);

    res.json(updated);
  } catch (error) {
    console.error("Error updateComment:", error);
    res.status(500).json({ message: "Gagal mengedit komentar", error });
  }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: Number(id) },
    });

    if (!comment) {
      return res.status(404).json({ message: "Komentar tidak ditemukan" });
    }

    if (comment.userId !== req.user?.userId) {
      return res
        .status(403)
        .json({ message: "Kamu tidak boleh menghapus komentar ini" });
    }

    await prisma.comment.delete({
      where: { id: Number(id) },
    });

    // Invalidate cache
    await redis.del(`${COMMENT_CACHE_PREFIX}:${comment.postId}`);

    res.json({ message: "Komentar berhasil dihapus" });
  } catch (error) {
    console.error("Error deleteComment:", error);
    res.status(500).json({ message: "Gagal menghapus komentar", error });
  }
};
