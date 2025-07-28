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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.updateComment = exports.getCommentsByPost = exports.createComment = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
        res.status(201).json(comment);
    }
    catch (err) {
        res.status(500).json({ message: "Gagal membuat komentar", error: err });
    }
});
exports.createComment = createComment;
const getCommentsByPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { postId } = req.params;
    try {
        const comments = yield prisma.comment.findMany({
            where: { postId: Number(postId) },
            include: {
                user: { select: { id: true, name: true } }, // untuk tampilkan siapa yang komen
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(comments);
    }
    catch (err) {
        res.status(500).json({ message: "Gagal mengambil komentar", error: err });
    }
});
exports.getCommentsByPost = getCommentsByPost;
const updateComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { content } = req.body;
    try {
        // Ambil komentar untuk cek kepemilikan
        const comment = yield prisma.comment.findUnique({
            where: { id: Number(id) },
        });
        if (!comment) {
            return res.status(404).json({ message: "Komentar tidak ditemukan" });
        }
        // Pastikan yang bisa edit adalah pemilik komentar
        if (comment.userId !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId)) {
            return res.status(403).json({ message: "Kamu tidak boleh mengedit komentar ini" });
        }
        const updated = yield prisma.comment.update({
            where: { id: Number(id) },
            data: { content },
        });
        res.json(updated);
    }
    catch (error) {
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
        // Pastikan hanya pemilik yang bisa hapus
        if (comment.userId !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId)) {
            return res.status(403).json({ message: "Kamu tidak boleh menghapus komentar ini" });
        }
        yield prisma.comment.delete({
            where: { id: Number(id) },
        });
        res.json({ message: "Komentar berhasil dihapus" });
    }
    catch (error) {
        res.status(500).json({ message: "Gagal menghapus komentar", error });
    }
});
exports.deleteComment = deleteComment;
