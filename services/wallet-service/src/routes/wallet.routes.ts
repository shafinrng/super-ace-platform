import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getBalance, placeBet, creditWin, getTransactions } from "../controllers/wallet.controller";
import { Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Service-to-Service Routes (no auth, internal use only) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
router.post("/service/bet", async (req: any, res: Response, next: NextFunction) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0) return res.status(400).json({ error: "Invalid userId or amount" });
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    if (Number(wallet.balance) < amount) return res.status(400).json({ error: "Insufficient balance" });
    const newBalance = Number(wallet.balance) - amount;
    await prisma.wallet.update({ where: { userId }, data: { balance: newBalance } });
    await prisma.transaction.create({ data: {
      userId, type: "BET", amount,
      balanceBefore: wallet.balance, balanceAfter: newBalance,
      description: "Slot bet (service)"
    }});
    res.json({ success: true, balance: newBalance });
  } catch (err) { next(err); }
});

router.post("/service/win", async (req: any, res: Response, next: NextFunction) => {
  try {
    const { userId, amount, reference } = req.body;
    if (!userId || amount === undefined || amount < 0) return res.status(400).json({ error: "Invalid userId or amount" });
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    const newBalance = Number(wallet.balance) + amount;
    await prisma.wallet.update({ where: { userId }, data: { balance: newBalance } });
    await prisma.transaction.create({ data: {
      userId, type: "WIN", amount,
      balanceBefore: wallet.balance, balanceAfter: newBalance,
      reference, description: "Slot win (service)"
    }});
    res.json({ success: true, balance: newBalance });
  } catch (err) { next(err); }
});

router.get("/service/balance/:userId", async (req: any, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    res.json({ success: true, balance: wallet.balance, currency: wallet.currency });
  } catch (err) { next(err); }
});

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Player-facing Routes (require auth) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
router.get("/balance", authenticate, getBalance);
router.post("/bet", authenticate, placeBet);
router.post("/win", authenticate, creditWin);
router.get("/transactions", authenticate, getTransactions);

// TEMPORARY: List wallets for debugging (remove in production)
router.get("/service/wallets", async (req: any, res: Response, next: NextFunction) => {
  try {
    const wallets = await prisma.wallet.findMany({ 
      select: { userId: true, balance: true, currency: true }, 
      take: 10 
    });
    res.json({ wallets });
  } catch (err) { next(err); }
});

export default router;