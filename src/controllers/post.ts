import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middlewares/auth";
import redis from "../lib/redis";

const prisma = new PrismaClient();

export const getAllPosts = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const cacheKey = `posts:page:${page}:limit:${limit}`;

  try {
    // 🔍 Cek cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // ⛏ Query ke database
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: {
          deletedAt: null,
        },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
          comments: {
            select: { id: true, content: true, userId: true, createdAt: true },
          },
          likes: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.post.count({
        where: { deletedAt: null },
      }),
    ]);

    const result = {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total,
      posts,
    };

    // 💾 Simpan ke Redis selama 60 detik
    await redis.set(cacheKey, JSON.stringify(result), "EX", 60);

    res.json(result);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

export const getPostsByUserId = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);

    const posts = await prisma.post.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
        likes: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengambil post user", error });
  }
};

export const createPost = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;

  try {
    const image = req.file ? `/uploads/posts/${req.file.filename}` : null;

    const post = await prisma.post.create({
      data: {
        content,
        image,
        userId: req.user!.userId,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        comments: true,
        likes: true,
      },
    });

    const io = req.app.get("io");
    io.emit("newPost", post);

    return res.status(201).json({ message: "Post created", post });
  } catch (err) {
    console.error("Gagal membuat post:", err);
    return res
      .status(500)
      .json({ message: "Failed to create post", error: err });
  }
};

export const softDeletePost = async (req: Request, res: Response) => {
  try {
    const postId = Number(req.params.id);

    const post = await prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    res.json({ message: "Post berhasil dihapus (soft delete)", post });
  } catch (error) {
    res.status(500).json({ message: "Gagal menghapus post", error });
  }
};

export const updatePost = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, image } = req.body;

  try {
    const existingPost = await prisma.post.findFirst({
      where: {
        id: Number(id),
        deletedAt: null,
      },
    });

    if (!existingPost) {
      return res
        .status(404)
        .json({ message: "Post not found or has been deleted." });
    }

    const updatedPost = await prisma.post.update({
      where: { id: Number(id) },
      data: {
        content,
        image,
      },
    });

    res
      .status(200)
      .json({ message: "Post updated successfully", data: updatedPost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update post" });
  }
};

export const restorePost = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const post = await prisma.post.findUnique({
      where: { id: Number(id) },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (!post.deletedAt) {
      return res.status(400).json({ message: "Post is not deleted" });
    }

    const restoredPost = await prisma.post.update({
      where: { id: Number(id) },
      data: { deletedAt: null },
    });

    res
      .status(200)
      .json({ message: "Post restored successfully", data: restoredPost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to restore post" });
  }
};

export const getPostCount = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const count = await prisma.post.count({
      where: {
        deletedAt: null,
        userId,
      },
    });

    res.json({ totalPosts: count });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil jumlah post" });
  }
};

export const getPostById = async (req: Request, res: Response) => {
  try {
    const postId = Number(req.params.id);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
        likes: true,
      },
    });

    if (!post || post.deletedAt) {
      return res
        .status(404)
        .json({ message: "Post tidak ditemukan atau sudah dihapus." });
    }

    res.status(200).json(post);
  } catch (error) {
    console.error("Gagal mengambil post:", error);
    res.status(500).json({ message: "Gagal mengambil post", error });
  }
};
