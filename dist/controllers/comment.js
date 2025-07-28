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
exports.deleteComment = exports.updateComment = exports.getCommentsByPost = exports.createComment = void 0;
const client_1 = require("@prisma/client");
const redis_1 = __importDefault(require("../lib/redis"));
const prisma = new client_1.PrismaClient();
const COMMENT_CACHE_PREFIX = "comments:post";
const CACHE_TTL = 60 * 5; // 5 minutes
const createComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { postId, content } = req.body;
    if (!content || !postId) {
        return res.status(400).json({ message: "PostId dan content wajib diisi" });
    }
    try {
        const comment = yield prisma.comment.create({
            data: {
                content,
                postId: Number(postId),
                userId: req.user.userId,
            },
        });
        // Invalidate cache
        yield redis_1.default.del(`${COMMENT_CACHE_PREFIX}:${postId}`);
        res.status(201).json(comment);
    }
    catch (err) {
        console.error("Error createComment:", err);
        res.status(500).json({ message: "Gagal membuat komentar", error: err });
    }
});
exports.createComment = createComment;
const getCommentsByPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { postId } = req.params;
    try {
        const cacheKey = `${COMMENT_CACHE_PREFIX}:${postId}`;
        const cached = yield redis_1.default.get(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }
        const comments = yield prisma.comment.findMany({
            where: { postId: Number(postId) },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        yield redis_1.default.set(cacheKey, JSON.stringify(comments), "EX", CACHE_TTL);
        res.json(comments);
    }
    catch (err) {
        console.error("Error getCommentsByPost:", err);
        res.status(500).json({ message: "Gagal mengambil komentar", error: err });
    }
});
exports.getCommentsByPost = getCommentsByPost;
const updateComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { content } = req.body;
    try {
        const comment = yield prisma.comment.findUnique({
            where: { id: Number(id) },
        });
        if (!comment) {
            return res.status(404).json({ message: "Komentar tidak ditemukan" });
        }
        if (comment.userId !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId)) {
            return res
                .status(403)
                .json({ message: "Kamu tidak boleh mengedit komentar ini" });
        }
        const updated = yield prisma.comment.update({
            where: { id: Number(id) },
            data: { content },
        });
        // Invalidate cache
        yield redis_1.default.del(`${COMMENT_CACHE_PREFIX}:${comment.postId}`);
        res.json(updated);
    }
    catch (error) {
        console.error("Error updateComment:", error);
        res.status(500).json({ message: "Gagal mengedit komentar", error });
    }
});
exports.updateComment = updateComment;
const deleteComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    try {
        const comment = yield prisma.comment.findUnique({
            where: { id: Number(id) },
        });
        if (!comment) {
            return res.status(404).json({ message: "Komentar tidak ditemukan" });
        }
        if (comment.userId !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId)) {
            return res
                .status(403)
                .json({ message: "Kamu tidak boleh menghapus komentar ini" });
        }
        yield prisma.comment.delete({
            where: { id: Number(id) },
        });
        // Invalidate cache
        yield redis_1.default.del(`${COMMENT_CACHE_PREFIX}:${comment.postId}`);
        res.json({ message: "Komentar berhasil dihapus" });
    }
    catch (error) {
        console.error("Error deleteComment:", error);
        res.status(500).json({ message: "Gagal menghapus komentar", error });
    }
});
exports.deleteComment = deleteComment;
