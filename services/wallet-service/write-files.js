const fs = require('fs');

// Fix package.json
fs.writeFileSync('package.json', JSON.stringify({
  name: "wallet-service",
  version: "1.0.0",
  main: "dist/index.js",
  scripts: {
    dev: "nodemon --watch src --ext ts --exec ts-node src/index.ts",
    build: "tsc",
    start: "node dist/index.js",
    "prisma:migrate": "prisma migrate dev"
  },
  author: "slim_shafin",
  license: "ISC"
}, null, 2), 'utf8');

// tsconfig.json
fs.writeFileSync('tsconfig.json', JSON.stringify({
  compilerOptions: {
    target: "ES2020", module: "commonjs", lib: ["ES2020"],
    outDir: "./dist", rootDir: "./src", strict: true,
    esModuleInterop: true, skipLibCheck: true, resolveJsonModule: true
  },
  include: ["src/**/*"], exclude: ["node_modules", "dist"]
}, null, 2), 'utf8');

// Create folders
['src', 'src/routes', 'src/controllers', 'src/middleware', 'prisma'].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// prisma/schema.prisma
fs.writeFileSync('prisma/schema.prisma', [
'generator client {',
'  provider = "prisma-client-js"',
'}',
'datasource db {',
'  provider = "postgresql"',
'  url      = env("DATABASE_URL")',
'}',
'model Transaction {',
'  id          String   @id @default(uuid())',
'  userId      String',
'  type        TxType',
'  amount      Decimal  @db.Decimal(18, 8)',
'  balanceBefore Decimal @db.Decimal(18, 8)',
'  balanceAfter  Decimal @db.Decimal(18, 8)',
'  reference   String?',
'  description String?',
'  createdAt   DateTime @default(now())',
'  @@map("transactions")',
'}',
'enum TxType {',
'  BET',
'  WIN',
'  DEPOSIT',
'  WITHDRAWAL',
'  REFUND',
'}'
].join('\n'), 'utf8');

// .env
fs.writeFileSync('.env', [
'DATABASE_URL=postgresql://superace:superace123@localhost:5432/superace_db',
'REDIS_URL=redis://:superace123@localhost:6379',
'WALLET_SERVICE_PORT=3003',
'NODE_ENV=development',
'AUTH_SERVICE_URL=http://localhost:3001'
].join('\n'), 'utf8');

// src/middleware/auth.ts
fs.writeFileSync('src/middleware/auth.ts', [
'import { Request, Response, NextFunction } from "express";',
'import jwt from "jsonwebtoken";',
'export interface AuthRequest extends Request {',
'  user?: { id: string; role: string; username: string };',
'}',
'export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {',
'  try {',
'    const token = req.headers.authorization?.split(" ")[1];',
'    if (!token) return res.status(401).json({ error: "No token" });',
'    const decoded = jwt.verify(token, process.env.JWT_SECRET || "super_ace_jwt_secret_change_in_production") as any;',
'    req.user = { id: decoded.id, role: decoded.role, username: decoded.username };',
'    next();',
'  } catch {',
'    res.status(401).json({ error: "Invalid token" });',
'  }',
'};'
].join('\n'), 'utf8');

// src/controllers/wallet.controller.ts
fs.writeFileSync('src/controllers/wallet.controller.ts', [
'import { Response, NextFunction } from "express";',
'import { PrismaClient } from "@prisma/client";',
'import { AuthRequest } from "../middleware/auth";',
'const prisma = new PrismaClient();',
'',
'export const getBalance = async (req: AuthRequest, res: Response, next: NextFunction) => {',
'  try {',
'    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });',
'    if (!wallet) return res.status(404).json({ error: "Wallet not found" });',
'    res.json({ success: true, balance: wallet.balance, currency: wallet.currency });',
'  } catch (err) { next(err); }',
'};',
'',
'export const placeBet = async (req: AuthRequest, res: Response, next: NextFunction) => {',
'  try {',
'    const { amount } = req.body;',
'    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });',
'    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });',
'    if (!wallet) return res.status(404).json({ error: "Wallet not found" });',
'    if (Number(wallet.balance) < amount) return res.status(400).json({ error: "Insufficient balance" });',
'    const newBalance = Number(wallet.balance) - amount;',
'    await prisma.wallet.update({ where: { userId: req.user!.id }, data: { balance: newBalance } });',
'    await prisma.transaction.create({ data: {',
'      userId: req.user!.id, type: "BET", amount,',
'      balanceBefore: wallet.balance, balanceAfter: newBalance,',
'      description: "Slot bet"',
'    }});',
'    res.json({ success: true, balance: newBalance });',
'  } catch (err) { next(err); }',
'};',
'',
'export const creditWin = async (req: AuthRequest, res: Response, next: NextFunction) => {',
'  try {',
'    const { amount, reference } = req.body;',
'    if (amount === undefined || amount < 0) return res.status(400).json({ error: "Invalid amount" });',
'    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });',
'    if (!wallet) return res.status(404).json({ error: "Wallet not found" });',
'    const newBalance = Number(wallet.balance) + amount;',
'    await prisma.wallet.update({ where: { userId: req.user!.id }, data: { balance: newBalance } });',
'    await prisma.transaction.create({ data: {',
'      userId: req.user!.id, type: "WIN", amount,',
'      balanceBefore: wallet.balance, balanceAfter: newBalance,',
'      reference, description: "Slot win"',
'    }});',
'    res.json({ success: true, balance: newBalance });',
'  } catch (err) { next(err); }',
'};',
'',
'export const getTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {',
'  try {',
'    const txs = await prisma.transaction.findMany({',
'      where: { userId: req.user!.id },',
'      orderBy: { createdAt: "desc" },',
'      take: 50',
'    });',
'    res.json({ success: true, transactions: txs });',
'  } catch (err) { next(err); }',
'};'
].join('\n'), 'utf8');

// src/routes/wallet.routes.ts
fs.writeFileSync('src/routes/wallet.routes.ts', [
'import { Router } from "express";',
'import { authenticate } from "../middleware/auth";',
'import { getBalance, placeBet, creditWin, getTransactions } from "../controllers/wallet.controller";',
'const router = Router();',
'router.get("/balance", authenticate, getBalance);',
'router.post("/bet", authenticate, placeBet);',
'router.post("/win", authenticate, creditWin);',
'router.get("/transactions", authenticate, getTransactions);',
'export default router;'
].join('\n'), 'utf8');

// src/index.ts
fs.writeFileSync('src/index.ts', [
'import express from "express";',
'import cors from "cors";',
'import helmet from "helmet";',
'import walletRoutes from "./routes/wallet.routes";',
'const app = express();',
'const PORT = process.env.WALLET_SERVICE_PORT || 3003;',
'app.use(helmet()); app.use(cors()); app.use(express.json());',
'app.use("/api/wallet", walletRoutes);',
'app.get("/health", (_req, res) => res.json({ status: "ok", service: "wallet-service", timestamp: new Date() }));',
'app.use((err: any, _req: any, res: any, _next: any) => res.status(err.statusCode || 500).json({ error: err.message }));',
'app.listen(PORT, () => console.log(`✅ Wallet Service running on port ${PORT}`));',
'export default app;'
].join('\n'), 'utf8');

console.log('All wallet service files written!');