import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middlewares/auth";

const prisma = new PrismaClient();

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
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: "Gagal membuat komentar", error: err });
  }
};

export const getCommentsByPost = async (req: Request, res: Response) => {
  const { postId } = req.params;

  try {
    const comments = await prisma.comment.findMany({
      where: { postId: Number(postId) },
      include: {
        user: { select: { id: true, name: true } }, // untuk tampilkan siapa yang komen
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil komentar", error: err });
  }
};

export const updateComment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;

  try {
    // Ambil komentar untuk cek kepemilikan
    const comment = await prisma.comment.findUnique({
      where: { id: Number(id) },
    });

    if (!comment) {
      return res.status(404).json({ message: "Komentar tidak ditemukan" });
    }

    // Pastikan yang bisa edit adalah pemilik komentar
    if (comment.userId !== req.user?.userId) {
      return res.status(403).json({ message: "Kamu tidak boleh mengedit komentar ini" });
    }

    const updated = await prisma.comment.update({
      where: { id: Number(id) },
      data: { content },
    });

    res.json(updated);
  } catch (error) {
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

    // Pastikan hanya pemilik yang bisa hapus
    if (comment.userId !== req.user?.userId) {
      return res.status(403).json({ message: "Kamu tidak boleh menghapus komentar ini" });
    }

    await prisma.comment.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Komentar berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: "Gagal menghapus komentar", error });
  }
};

