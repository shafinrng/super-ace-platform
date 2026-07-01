import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from './error.middleware';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; username: string };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new AppError('No token provided', 401);
    const decoded = verifyToken(token);
    req.user = { id: decoded.id, role: decoded.role, username: decoded.username };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
};