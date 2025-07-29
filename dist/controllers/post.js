"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPostById = exports.getPostCount = exports.restorePost = exports.updatePost = exports.softDeletePost = exports.createPost = exports.getPostsByUserId = exports.getAllPosts = void 0;
const client_1 = require("@prisma/client");
const redis_1 = __importDefault(require("../lib/redis"));
const prisma = new client_1.PrismaClient();
const getAllPosts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const cacheKey = `posts:page:${page}:limit:${limit}`;
    try {
        // 🔍 Cek cache
        const cached = yield redis_1.default.get(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }
        // ⛏ Query ke database
        const [posts, total] = yield Promise.all([
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
        yield redis_1.default.set(cacheKey, JSON.stringify(result), "EX", 60);
        res.json(result);
    }
    catch (err) {
        console.error("Error fetching posts:", err);
        res.status(500).json({ message: "Failed to fetch posts" });
    }
});
exports.getAllPosts = getAllPosts;
const getPostsByUserId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = Number(req.params.userId);
        const posts = yield prisma.post.findMany({
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal mengambil post user", error });
    }
});
exports.getPostsByUserId = getPostsByUserId;
const createPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { content } = req.body;
    try {
        const image = req.file ? `/uploads/posts/${req.file.filename}` : null;
        const post = yield prisma.post.create({
            data: {
                content,
                image,
                userId: req.user.userId,
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
    }
    catch (err) {
        console.error("Gagal membuat post:", err);
        return res
            .status(500)
            .json({ message: "Failed to create post", error: err });
    }
});
exports.createPost = createPost;
const softDeletePost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const postId = Number(req.params.id);
        const post = yield prisma.post.update({
            where: { id: postId },
            data: { deletedAt: new Date() },
        });
        res.json({ message: "Post berhasil dihapus (soft delete)", post });
    }
    catch (error) {
        res.status(500).json({ message: "Gagal menghapus post", error });
    }
});
exports.softDeletePost = softDeletePost;
const updatePost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { content, image } = req.body;
    try {
        const existingPost = yield prisma.post.findFirst({
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
        const updatedPost = yield prisma.post.update({
            where: { id: Number(id) },
            data: {
                content,
                image,
            },
        });
        res
            .status(200)
            .json({ message: "Post updated successfully", data: updatedPost });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update post" });
    }
});
exports.updatePost = updatePost;
const restorePost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const post = yield prisma.post.findUnique({
            where: { id: Number(id) },
        });
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        if (!post.deletedAt) {
            return res.status(400).json({ message: "Post is not deleted" });
        }
        const restoredPost = yield prisma.post.update({
            where: { id: Number(id) },
            data: { deletedAt: null },
        });
        res
            .status(200)
            .json({ message: "Post restored successfully", data: restoredPost });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to restore post" });
    }
});
exports.restorePost = restorePost;
const getPostCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = Number(req.params.userId);
        const count = yield prisma.post.count({
            where: {
                deletedAt: null,
                userId,
            },
        });
        res.json({ totalPosts: count });
    }
    catch (error) {
        res.status(500).json({ message: "Gagal mengambil jumlah post" });
    }
});
exports.getPostCount = getPostCount;
const getPostById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const postId = Number(req.params.id);
        const post = yield prisma.post.findUnique({
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
    }
    catch (error) {
        console.error("Gagal mengambil post:", error);
        res.status(500).json({ message: "Gagal mengambil post", error });
    }
});
exports.getPostById = getPostById;
