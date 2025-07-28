
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "my-jwt-key";

export interface AuthRequest extends Request {
  user?: {
    userId: number;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token =
    req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Token missing" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.user = { userId: decoded.userId };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};
