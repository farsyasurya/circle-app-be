import express from "express";
import {
  getProfile,
  getUserById,
  login,
  logout,
  register,
  searchUsers,
  updateProfile,
} from "../controllers/auth";
import { authenticate, AuthRequest } from "../middlewares/auth";
import { uploadAvatar, uploadPostImage } from "../utils/multer";
import {
  createPost,
  getAllPosts,
  getPostById,
  getPostCount,
  getPostsByUserId,
  restorePost,
  softDeletePost,
  updatePost,
} from "../controllers/post";
import {
  unFollow,
  getFollowCount,
  getFollowers,
  getFollowing,
  createFollowers,
  createFollowing,
  getSuggestedUsers,
} from "../controllers/followers";
import { getLikesByPost, likePost, unlikePost } from "../controllers/like";
import {
  createComment,
  deleteComment,
  getCommentsByPost,
  updateComment,
} from "../controllers/comment";
import { PrismaClient } from "@prisma/client";

export const router = express.Router();
export const postRouter = express.Router();
export const comments = express.Router();
const prisma = new PrismaClient();

router.post("/register", uploadAvatar.single("avatar"), register);
router.post("/login", login);
router.post("/logout", logout);
router.patch(
  "/update-profile",
  authenticate,
  uploadAvatar.single("avatar"),
  updateProfile
);
router.get("/profile", authenticate, getProfile);
router.get("/search", authenticate, searchUsers);
router.get("/user/:id", authenticate, getUserById);

router.get("/followers/:userId", authenticate, getFollowers);
router.get("/following/:userId", authenticate, getFollowing);
router.get("/count-follow/:userId", authenticate, getFollowCount);
router.post("/add-followers", authenticate, createFollowers);
router.post("/add-following", authenticate, createFollowing);
router.delete("/unfollow/:id", authenticate, unFollow);
router.get("/suggested-users/:userId", authenticate, getSuggestedUsers);

postRouter.post(
  "/create",
  authenticate,
  uploadPostImage.single("posts"),
  createPost
);

postRouter.get("/", authenticate, getAllPosts);
postRouter.get("/:userId", authenticate, getPostsByUserId);
postRouter.get("/post-by-postId/:id", authenticate, getPostById);
postRouter.delete("/delete/:id", authenticate, softDeletePost);
postRouter.put("/update/:id", authenticate, updatePost);
postRouter.patch("/:id/restore", authenticate, restorePost);
postRouter.get("/count/:userId", authenticate, getPostCount);

postRouter.post("/:postId/like", authenticate, likePost);
postRouter.delete("/:postId/unlike", authenticate, unlikePost);
postRouter.get("/:postId/likes", authenticate, getLikesByPost);

comments.post("/", authenticate, createComment);
comments.get("/:postId", authenticate, getCommentsByPost);
comments.put("/update/:id", authenticate, updateComment);
comments.delete("/delete/:id", authenticate, deleteComment);
