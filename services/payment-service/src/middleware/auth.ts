import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
export interface AuthRequest extends Request {
  user?: { id: string; role: string; username: string };
}
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "super_ace_jwt_secret_change_in_production") as any;
    req.user = { id: decoded.id, role: decoded.role, username: decoded.username };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
