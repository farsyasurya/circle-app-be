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
exports.searchUsers = exports.updateProfile = exports.getUserById = exports.getProfile = exports.logout = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, email, password } = req.body;
    try {
        const exist = yield prisma.user.findUnique({ where: { email } });
        if (exist) {
            res.status(400).json({ message: "Email already used" });
            return;
        }
        const hashed = yield bcrypt_1.default.hash(password, 10);
        const avatar = req.file ? `/uploads/avatars/${req.file.filename}` : null;
        const user = yield prisma.user.create({
            data: { name, email, password: hashed, avatar },
        });
        {
            res.status(201).json({ message: "Register successful", user });
            return;
        }
    }
    catch (err) {
        res.status(500).json({ message: "Register failed", error: err });
        return;
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        const user = yield prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const isMatch = yield bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: "Wrong password" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, {
            expiresIn: "1d",
        });
        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            maxAge: 1000 * 60 * 60 * 24,
        });
        req.session.token = token;
        res.json({
            message: "Login success",
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
            },
        });
        return;
    }
    catch (err) {
        res.status(500).json({ message: "Login failed", error: err });
        return;
    }
});
exports.login = login;
const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Logout gagal" });
        }
        res.clearCookie("connect.sid");
        return res.json({ success: true, message: "Logout berhasil" });
    });
};
exports.logout = logout;
const getProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const user = yield prisma.user.findUnique({ where: { id: userId } });
    res.json(user);
});
exports.getProfile = getProfile;
const getUserById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = Number(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        const user = yield prisma.user.findUnique({
            where: { id: userId },
            include: {
                posts: {
                    include: {
                        _count: {
                            select: { likes: true, comments: true },
                        },
                    },
                },
                comments: true,
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Hitung followers (orang yang follow dia)
        const followersCount = yield prisma.followers.count({
            where: { followId: userId, flag: 1 },
        });
        // Hitung following (dia follow siapa saja)
        const followingCount = yield prisma.followers.count({
            where: { userId: userId, flag: 2 },
        });
        res.json(Object.assign(Object.assign({}, user), { followersCount,
            followingCount, postsCount: user.posts.length }));
    }
    catch (err) {
        console.error("Error getting user by ID:", err);
        res.status(500).json({ message: "Failed to get user by ID" });
    }
});
exports.getUserById = getUserById;
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId; // pastikan pakai userId dari middleware
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { name } = req.body;
        const avatarFile = req.file;
        const user = yield prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        let avatarPath = user.avatar;
        if (avatarFile) {
            // Hapus avatar lama jika ada
            if (avatarPath) {
                const oldPath = path_1.default.join(__dirname, "..", avatarPath);
                if (fs_1.default.existsSync(oldPath)) {
                    try {
                        fs_1.default.unlinkSync(oldPath);
                    }
                    catch (err) {
                        console.error("Gagal hapus avatar lama:", err);
                    }
                }
            }
            // Simpan path baru
            avatarPath = `/uploads/avatars/${avatarFile.filename}`;
        }
        const updatedUser = yield prisma.user.update({
            where: { id: userId },
            data: {
                name: name || user.name,
                avatar: avatarPath,
            },
        });
        res.json({
            message: "Profile updated successfully",
            user: updatedUser,
        });
    }
    catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ message: "Failed to update profile" });
    }
});
exports.updateProfile = updateProfile;
const searchUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const nameQuery = req.query.name;
    try {
        const users = yield prisma.user.findMany({
            where: {
                name: {
                    contains: nameQuery,
                    mode: "insensitive",
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
            },
        });
        res.json(users);
    }
    catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ message: "Failed to search users" });
    }
});
exports.searchUsers = searchUsers;
