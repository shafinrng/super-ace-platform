import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'fallback_secret';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

export const signToken = (payload: object): string => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES } as jwt.SignOptions);
};

export const verifyToken = (token: string): jwt.JwtPayload => {
  return jwt.verify(token, SECRET) as jwt.JwtPayload;
};