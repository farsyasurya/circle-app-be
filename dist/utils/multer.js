"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPostImage = exports.uploadAvatar = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const createStorage = (folder) => {
    const uploadPath = path_1.default.join(__dirname, "../../uploads", folder);
    fs_1.default.mkdirSync(uploadPath, { recursive: true });
    return multer_1.default.diskStorage({
        destination: (_, __, cb) => cb(null, uploadPath),
        filename: (_, file, cb) => {
            const uniqueName = `${Date.now()}-${file.originalname}`;
            cb(null, uniqueName);
        },
    });
};
exports.uploadAvatar = (0, multer_1.default)({ storage: createStorage("avatars") });
exports.uploadPostImage = (0, multer_1.default)({ storage: createStorage("posts") });
