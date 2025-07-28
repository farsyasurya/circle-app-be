import multer from "multer";
import path from "path";
import fs from "fs";

const createStorage = (folder: string) => {
  const uploadPath = path.join(__dirname, "../../uploads", folder);
  fs.mkdirSync(uploadPath, { recursive: true });

  return multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadPath),
    filename: (_, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  });
};

export const uploadAvatar = multer({ storage: createStorage("avatars") });
export const uploadPostImage = multer({ storage: createStorage("posts") });
