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
exports.getLikesByPost = exports.unlikePost = exports.likePost = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// 1. Like post
const likePost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("USER FROM TOKEN:", req.user);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const postId = Number(req.params.postId);
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const existingLike = yield prisma.like.findFirst({
            where: { userId, postId },
        });
        if (existingLike) {
            return res.status(400).json({ message: "You already liked this post" });
        }
        const like = yield prisma.like.create({
            data: { userId, postId },
        });
        res.status(201).json({ message: "Liked", like });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to like post", error });
    }
});
exports.likePost = likePost;
// 2. Unlike post
const unlikePost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const postId = Number(req.params.postId);
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const existingLike = yield prisma.like.findFirst({
            where: { userId, postId },
        });
        if (!existingLike) {
            return res.status(404).json({ message: "Like not found" });
        }
        yield prisma.like.delete({
            where: { id: existingLike.id },
        });
        res.json({ message: "Unliked" });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to unlike post", error });
    }
});
exports.unlikePost = unlikePost;
// 3. Get all likes for a post
const getLikesByPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const postId = Number(req.params.postId);
    try {
        const likes = yield prisma.like.findMany({
            where: { postId },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
            },
        });
        res.json(likes);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch likes", error });
    }
});
exports.getLikesByPost = getLikesByPost;
