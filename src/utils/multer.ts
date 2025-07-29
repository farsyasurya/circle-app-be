// lib/multer.ts
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "uploads/avatars",
    format: async () => "png", // ✅ hanya satu format dan tanpa spasi
    public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  }),
});

const postStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "uploads/posts",
    format: async () => "jpg", // ✅ hanya satu format
    public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
    transformation: [{ width: 1000, crop: "limit" }],
  }),
});

export const uploadAvatar = multer({ storage: avatarStorage });
export const uploadPostImage = multer({ storage: postStorage });
