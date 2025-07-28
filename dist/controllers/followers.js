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
exports.getSuggestedUsers = exports.createFollowing = exports.createFollowers = exports.unFollow = exports.getFollowCount = exports.getFollowing = exports.getFollowers = void 0;
const client_1 = require("@prisma/client");
const redis_1 = __importDefault(require("../lib/redis"));
const prisma = new client_1.PrismaClient();
const CACHE_TTL = 60 * 5; // 5 minutes
const getFollowers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = Number(req.params.userId);
    const cacheKey = `followers:${userId}`;
    try {
        const cached = yield redis_1.default.get(cacheKey);
        if (cached)
            return res.json(JSON.parse(cached));
        const followers = yield prisma.followers.findMany({
            where: { userId, flag: 1 },
            include: {
                user: {
                    select: { id: true, name: true, avatar: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        yield redis_1.default.set(cacheKey, JSON.stringify(followers), "EX", CACHE_TTL);
        res.json(followers);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal mengambil followers", error });
    }
});
exports.getFollowers = getFollowers;
const getFollowing = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = Number(req.params.userId);
    const cacheKey = `following:${userId}`;
    try {
        const cached = yield redis_1.default.get(cacheKey);
        if (cached)
            return res.json(JSON.parse(cached));
        const following = yield prisma.followers.findMany({
            where: { userId, flag: 2 },
            include: {
                user: {
                    select: { id: true, name: true, avatar: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        yield redis_1.default.set(cacheKey, JSON.stringify(following), "EX", CACHE_TTL);
        res.json(following);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal mengambil following", error });
    }
});
exports.getFollowing = getFollowing;
const getFollowCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = Number(req.params.userId);
    const cacheKey = `followCount:${userId}`;
    try {
        const cached = yield redis_1.default.get(cacheKey);
        if (cached)
            return res.json(JSON.parse(cached));
        const [followers, following] = yield Promise.all([
            prisma.followers.count({ where: { userId, flag: 1 } }),
            prisma.followers.count({ where: { userId, flag: 2 } }),
        ]);
        const data = { totalFollowers: followers, totalFollowing: following };
        yield redis_1.default.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL);
        res.json(data);
    }
    catch (error) {
        console.error(error);
        res
            .status(500)
            .json({ message: "Gagal mengambil jumlah followers/following", error });
    }
});
exports.getFollowCount = getFollowCount;
const unFollow = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = Number(req.params.id);
    try {
        const followRecord = yield prisma.followers.findUnique({ where: { id } });
        if (!followRecord)
            return res.status(404).json({ message: "Data follow tidak ditemukan" });
        yield prisma.followers.delete({ where: { id } });
        // Invalidate both users' follow caches
        yield redis_1.default.del(`followers:${followRecord.userId}`, `following:${followRecord.userId}`, `followCount:${followRecord.userId}`, `suggested:${followRecord.userId}`);
        res.json({ message: "Unfollow berhasil" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal melakukan unfollow", error });
    }
});
exports.unFollow = unFollow;
const createFollowers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { followId, userId } = req.body;
    if (userId === followId) {
        return res
            .status(400)
            .json({ message: "Kamu tidak bisa mengikuti dirimu sendiri" });
    }
    try {
        const existing = yield prisma.followers.findFirst({
            where: { followId, userId, flag: 1 },
        });
        if (existing)
            return res.json({ message: "Sudah mengikuti" });
        const followers = yield prisma.followers.create({
            data: { followId, userId, flag: 1 },
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
        // Invalidate related caches
        yield redis_1.default.del(`followers:${followId}`, `followCount:${followId}`, `suggested:${userId}`);
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
            data: { followId, userId, flag: 2 },
        });
        const cekFollowers = yield prisma.followers.findFirst({
            where: { followId: userId, userId: followId, flag: 1 },
        });
        if (!cekFollowers) {
            yield prisma.followers.create({
                data: { followId: userId, userId: followId, flag: 1 },
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
        yield redis_1.default.del(`following:${userId}`, `followers:${followId}`, `followCount:${userId}`, `followCount:${followId}`, `suggested:${userId}`);
        return res.status(201).json({ message: "Following created", following });
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
    const userId = Number(req.params.userId);
    const cacheKey = `suggested:${userId}`;
    if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }
    try {
        const cached = yield redis_1.default.get(cacheKey);
        if (cached)
            return res.json(JSON.parse(cached));
        const following = yield prisma.followers.findMany({
            where: { userId, flag: 2 },
            select: { followId: true },
        });
        const followingIds = following.map((f) => f.followId);
        const suggestedUsers = yield prisma.user.findMany({
            where: {
                id: {
                    notIn: [...followingIds, userId],
                },
            },
            select: { id: true, name: true, email: true, avatar: true },
            take: 5,
        });
        yield redis_1.default.set(cacheKey, JSON.stringify(suggestedUsers), "EX", CACHE_TTL);
        res.json(suggestedUsers);
    }
    catch (err) {
        console.error("Error fetching suggested users:", err);
        res.status(500).json({ message: "Failed to fetch suggested users" });
    }
});
exports.getSuggestedUsers = getSuggestedUsers;
