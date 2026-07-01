import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "audit.log");

export function auditLog(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const adminId = (req as any).user?.id || "anonymous";

  res.on("finish", () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} | Admin: ${adminId} | Status: ${res.statusCode} | ${duration}ms | Body: ${JSON.stringify(req.body)}\n`;
    fs.appendFileSync(LOG_FILE, log);
  });

  next();
}
