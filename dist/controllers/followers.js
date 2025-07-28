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
exports.getSuggestedUsers = exports.createFollowing = exports.createFollowers = exports.getFollowCount = exports.unFollow = exports.getFollowing = exports.getFollowers = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getFollowers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = Number(req.params.userId);
        const followers = yield prisma.followers.findMany({
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal mengambil followers", error });
    }
});
exports.getFollowers = getFollowers;
const getFollowing = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = Number(req.params.userId);
        const following = yield prisma.followers.findMany({
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal mengambil following", error });
    }
});
exports.getFollowing = getFollowing;
const unFollow = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        yield prisma.followers.delete({
            where: { id },
        });
        res.json({ message: "Unfollow berhasil" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal melakukan unfollow", error });
    }
});
exports.unFollow = unFollow;
const getFollowCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = Number(req.params.userId);
        const followers = yield prisma.followers.count({
            where: {
                userId: userId,
                flag: 1,
            },
        });
        const following = yield prisma.followers.count({
            where: {
                userId,
                flag: 2,
            },
        });
        res.json({ totalFollowers: followers, totalFollowing: following });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: "Gagal mengambil jumlah followers/following" });
    }
});
exports.getFollowCount = getFollowCount;
const createFollowers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { followId, userId } = req.body;
    if (userId === followId) {
        return res
            .status(400)
            .json({ message: "Kamu tidak bisa mengikuti dirimu sendiri" });
    }
    const cekFollowers = yield prisma.followers.findFirst({
        where: { followId, userId, flag: 1 },
    });
    if (cekFollowers) {
        return res.json({ message: "gagal follow" });
    }
    try {
        const followers = yield prisma.followers.create({
            data: {
                followId,
                userId,
                flag: 1,
            },
        });
        const user = yield prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        const io = req.app.get("io");
        io.emit("newFollow", followers);
        const targetUserRoom = `user-${followId}`;
        io.to(targetUserRoom).emit("followNotification", {
            fromUserId: userId,
            fromUserName: (user === null || user === void 0 ? void 0 : user.name) || "Seseorang",
            message: "Kamu punya pengikut baru!",
        });
        return res.status(201).json({ message: "Followed", followers });
    }
    catch (err) {
        console.error("Gagal mengikuti:", err);
        return res.status(500).json({ message: "Failed to follow", error: err });
    }
});
exports.createFollowers = createFollowers;
const createFollowing = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { followId, userId } = req.body;
    try {
        const following = yield prisma.followers.create({
            data: {
                followId: followId,
                userId: userId,
                flag: 2,
            },
        });
        const cekFollowers = yield prisma.followers.findFirst({
            where: { followId: userId, userId: followId, flag: 1 },
        });
        if (!cekFollowers) {
            const followers = yield prisma.followers.create({
                data: {
                    followId: userId,
                    userId: followId,
                    flag: 1,
                },
            });
        }
        const user = yield prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        const io = req.app.get("io");
        io.emit("newFollow", following);
        const targetUserRoom = `user-${followId}`;
        io.to(targetUserRoom).emit("followNotification", {
            fromUserId: userId,
            fromUserName: (user === null || user === void 0 ? void 0 : user.name) || "Seseorang",
            message: "Kamu punya pengikut baru!",
        });
        return res
            .status(201)
            .json({ message: "Following created", following: following });
    }
    catch (err) {
        console.error("Gagal membuat following:", err);
        return res
            .status(500)
            .json({ message: "Failed to create following", error: err });
    }
});
exports.createFollowing = createFollowing;
const getSuggestedUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = Number(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        // Ambil semua user yang **bukan** dirinya sendiri dan belum di-follow
        const following = yield prisma.followers.findMany({
            where: {
                userId: userId,
                flag: 2, // mengikuti siapa saja
            },
            select: {
                followId: true,
            },
        });
        const followingIds = following.map((f) => f.followId);
        const suggestedUsers = yield prisma.user.findMany({
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
    }
    catch (err) {
        console.error("Error fetching suggested users:", err);
        res.status(500).json({ message: "Failed to fetch suggested users" });
    }
});
exports.getSuggestedUsers = getSuggestedUsers;
