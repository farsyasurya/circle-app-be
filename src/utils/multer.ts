// lib/multer.ts
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "uploads/avatars",
    format: "png , jpg", // atau jpg
    public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  }),
});

const postStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "uploads/posts",
    format: "jpg",
    public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
    transformation: [{ width: 1000, crop: "limit" }],
  }),
});

export const uploadAvatar = multer({ storage: avatarStorage });
export const uploadPostImage = multer({ storage: postStorage });
