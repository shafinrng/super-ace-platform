import { Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";
const prisma = new PrismaClient();

export const getBalance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    res.json({ success: true, balance: wallet.balance, currency: wallet.currency });
  } catch (err) { next(err); }
};

export const placeBet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    if (Number(wallet.balance) < amount) return res.status(400).json({ error: "Insufficient balance" });
    const newBalance = Number(wallet.balance) - amount;
    await prisma.wallet.update({ where: { userId: req.user!.id }, data: { balance: newBalance } });
    await prisma.transaction.create({ data: {
      userId: req.user!.id, type: "BET", amount,
      balanceBefore: wallet.balance, balanceAfter: newBalance,
      description: "Slot bet"
    }});
    res.json({ success: true, balance: newBalance });
  } catch (err) { next(err); }
};

export const creditWin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, reference } = req.body;
    if (amount === undefined || amount < 0) return res.status(400).json({ error: "Invalid amount" });
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    const newBalance = Number(wallet.balance) + amount;
    await prisma.wallet.update({ where: { userId: req.user!.id }, data: { balance: newBalance } });
    await prisma.transaction.create({ data: {
      userId: req.user!.id, type: "WIN", amount,
      balanceBefore: wallet.balance, balanceAfter: newBalance,
      reference, description: "Slot win"
    }});
    res.json({ success: true, balance: newBalance });
  } catch (err) { next(err); }
};

export const getTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const txs = await prisma.transaction.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json({ success: true, transactions: txs });
  } catch (err) { next(err); }
};