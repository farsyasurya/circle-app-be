import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";

import { comments, postRouter, router } from "./routes/route";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

const swaggerDocument = YAML.load("./swagger.yaml");

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

app.set("io", io);

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.JWT_SECRET || "my-jwt-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// Routing
app.use("/uploads", express.static("src/uploads/avatars"));
app.use("/auth", router);
app.use("/post", postRouter);
app.use("/comments", comments);

app.get("/", (req, res) => {
  res.send("🎉 Circle API is running!");
});

// WebSocket Events
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.on("new-post", (data) => {
    console.log("📤 New post:", data);
    io.emit("receive-post", data);
  });

  socket.on("new-comment", (data) => {
    console.log("💬 New comment:", data);
    io.emit("receive-comment", data);
  });

  socket.on("new-like", (data) => {
    console.log("❤️ New like event:", data);
    socket.broadcast.emit("receive-like", data);
  });

  socket.on("newFollow", (data) => {
    console.log("📡 newFollow event received:", data);
    socket.broadcast.emit("newFollow", data);
  });

  socket.on("newUnfollow", (data) => {
    console.log("📡 newUnfollow event received:", data);
    socket.broadcast.emit("newUnfollow", data);
  });

  socket.on("join", (userId: number) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined room user-${userId}`);
  });

  socket.on("edit-post", (data) => {
    console.log("✏️ Edit post:", data);
    io.emit("update-post", data);
  });

  socket.on("delete-post", (postId) => {
    console.log("🗑️ Post deleted:", postId);
    io.emit("remove-post", postId);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// Start server
httpServer.listen(Number(PORT), () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
