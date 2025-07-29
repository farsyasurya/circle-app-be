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
exports.uploadPostImage = exports.uploadAvatar = void 0;
// lib/multer.ts
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const multer_1 = __importDefault(require("multer"));
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const avatarStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: (req, file) => __awaiter(void 0, void 0, void 0, function* () {
        return ({
            folder: "uploads/avatars",
            format: () => __awaiter(void 0, void 0, void 0, function* () { return "png"; }), // ✅ hanya satu format dan tanpa spasi
            public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
            transformation: [{ width: 500, height: 500, crop: "limit" }],
        });
    }),
});
const postStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: (req, file) => __awaiter(void 0, void 0, void 0, function* () {
        return ({
            folder: "uploads/posts",
            format: () => __awaiter(void 0, void 0, void 0, function* () { return "jpg"; }), // ✅ hanya satu format
            public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
            transformation: [{ width: 1000, crop: "limit" }],
        });
    }),
});
exports.uploadAvatar = (0, multer_1.default)({ storage: avatarStorage });
exports.uploadPostImage = (0, multer_1.default)({ storage: postStorage });
