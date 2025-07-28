"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const route_1 = require("./routes/route");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yamljs_1 = __importDefault(require("yamljs"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const httpServer = (0, http_1.createServer)(app);
const swaggerDocument = yamljs_1.default.load("./swagger.yaml");
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        credentials: true,
    },
});
app.set("io", io);
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.use((0, cors_1.default)({
    origin: "http://localhost:5173",
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, express_session_1.default)({
    secret: process.env.JWT_SECRET || "my-jwt-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
    },
}));
// Routing
app.use("/uploads", express_1.default.static("src/uploads/avatars"));
app.use("/auth", route_1.router);
app.use("/post", route_1.postRouter);
app.use("/comments", route_1.comments);
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
    socket.on("join", (userId) => {
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
