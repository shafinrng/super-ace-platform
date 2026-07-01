import { Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { AuthRequest } from "../middleware/auth";
const prisma = new PrismaClient();
const WALLET_URL = process.env.WALLET_SERVICE_URL || "http://localhost:3003";
const GAME_URL = process.env.GAME_ENGINE_URL || "http://localhost:3002";

let alertHistory: { id: string; type: string; message: string; severity: string; createdAt: Date }[] = [];
let lastAlertMessage = "";

function addAlert(type: string, message: string, severity: string) {
  if (message === lastAlertMessage) return;
  lastAlertMessage = message;
  alertHistory.unshift({
    id: Math.random().toString(36).substring(7),
    type,
    message,
    severity,
    createdAt: new Date(),
  });
  if (alertHistory.length > 50) alertHistory = alertHistory.slice(0, 50);
}

export const getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, activeUsers, totalTransactions, pendingPayments] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.transaction.count(),
      prisma.payment.count({ where: { status: "PENDING" } }),
    ]);
    const revenueResult = await prisma.transaction.aggregate({
      where: { type: "BET" },
      _sum: { amount: true },
    });
    const winResult = await prisma.transaction.aggregate({
      where: { type: "WIN" },
      _sum: { amount: true },
    });
    const totalBets = Number(revenueResult._sum.amount || 0);
    const totalWins = Number(winResult._sum.amount || 0);
    const houseEdge = totalBets > 0 ? ((totalBets - totalWins) / totalBets * 100).toFixed(2) : "0";
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, username: true, email: true, role: true, isActive: true, createdAt: true },
    });
    const recentTransactions = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    res.json({
      success: true,
      stats: { totalUsers, activeUsers, totalTransactions, pendingPayments, totalBets, totalWins, houseEdge },
      recentUsers,
      recentTransactions,
    });
  } catch (err: any) { next(err); }
};

export const getPlayers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = search ? { OR: [{ username: { contains: String(search) } }, { email: { contains: String(search) } }] } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: "desc" },
        select: { id: true, username: true, email: true, role: true, isActive: true, createdAt: true, wallet: { select: { balance: true, currency: true } } },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, users, total, page: Number(page), limit: Number(limit) });
  } catch (err: any) { next(err); }
};

export const getPlayer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, username: true, email: true, role: true, isActive: true, createdAt: true,
        wallet: { select: { balance: true, currency: true } },
      },
    });
    if (!user) return res.status(404).json({ error: "Player not found" });
    const transactions = await prisma.transaction.findMany({
      where: { userId: String(req.params.id) },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const payments = await prisma.payment.findMany({
      where: { userId: String(req.params.id) },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    res.json({ success: true, user, transactions, payments });
  } catch (err: any) { next(err); }
};

export const togglePlayerStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!user) return res.status(404).json({ error: "Player not found" });
    const updated = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { isActive: !user.isActive },
    });
    res.json({ success: true, isActive: updated.isActive, message: `Player ${updated.isActive ? "activated" : "banned"}` });
  } catch (err: any) { next(err); }
};

export const adjustBalance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, reason } = req.body;
    if (!amount || !reason) return res.status(400).json({ error: "Amount and reason required" });
    const wallet = await prisma.wallet.findUnique({ where: { userId: String(req.params.id) } });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    const newBalance = Number(wallet.balance) + Number(amount);
    if (newBalance < 0) return res.status(400).json({ error: "Balance cannot go negative" });
    await prisma.wallet.update({ where: { userId: String(req.params.id) }, data: { balance: newBalance } });
    await prisma.transaction.create({
      data: {
        userId: String(req.params.id),
        type: amount > 0 ? "DEPOSIT" : "WITHDRAWAL",
        amount: Math.abs(amount),
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: `Admin adjustment: ${reason}`,
      }
    });
    res.json({ success: true, newBalance, message: "Balance adjusted" });
  } catch (err: any) { next(err); }
};

export const getTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 50, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = type ? { type: String(type) as any } : {};
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: "desc" } }),
      prisma.transaction.count({ where }),
    ]);
    res.json({ success: true, transactions, total });
  } catch (err: any) { next(err); }
};

export const getPayments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = status ? { status: String(status) as any } : {};
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: "desc" } }),
      prisma.payment.count({ where }),
    ]);
    res.json({ success: true, payments, total });
  } catch (err: any) { next(err); }
};

export const approveWithdrawal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: String(req.params.id) } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.status !== "PROCESSING") return res.status(400).json({ error: "Payment not in processing state" });
    await prisma.payment.update({ where: { id: String(req.params.id) }, data: { status: "COMPLETED", completedAt: new Date() } });
    res.json({ success: true, message: "Withdrawal approved and completed" });
  } catch (err: any) { next(err); }
};

export const makeAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { role: "ADMIN" },
    });
    res.json({ success: true, message: `${updated.username} is now an admin` });
  } catch (err: any) { next(err); }
};

export const getRtpConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data } = await axios.get(`${GAME_URL}/api/game/rtp`);
    res.json(data);
  } catch (err: any) { next(err); }
};

export const setRtpConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { target } = req.body;
    const { data } = await axios.put(`${GAME_URL}/api/game/rtp`, { target });
    res.json(data);
  } catch (err: any) { next(err); }
};

export const resetRtpStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data } = await axios.post(`${GAME_URL}/api/game/rtp/reset`);
    res.json(data);
  } catch (err: any) { next(err); }
};

export const getPlayerRtps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data } = await axios.get(`${GAME_URL}/api/game/rtp/players`);
    res.json(data);
  } catch (err: any) { next(err); }
};

export const getPlayerRtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data } = await axios.get(`${GAME_URL}/api/game/rtp/players/${req.params.id}`);
    res.json(data);
  } catch (err: any) { next(err); }
};

export const setPlayerRtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rtp } = req.body;
    const { data } = await axios.put(`${GAME_URL}/api/game/rtp/players/${req.params.id}`, { rtp });
    res.json(data);
  } catch (err: any) { next(err); }
};

export const deletePlayerRtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data } = await axios.delete(`${GAME_URL}/api/game/rtp/players/${req.params.id}`);
    res.json(data);
  } catch (err: any) { next(err); }
};

export const getAlerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, alerts: alertHistory });
  } catch (err: any) { next(err); }
};

export const checkRtpAlert = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data } = await axios.get(`${GAME_URL}/api/game/rtp`);
    const { target, actualRtp, totalBets } = data;
    const diff = Math.abs(actualRtp - target);
    let alert = null;
    if (diff > 15) {
      alert = { type: "RTP_CRITICAL", message: `CRITICAL: RTP drifted ${diff.toFixed(2)}% from target (${target}%). Actual: ${actualRtp.toFixed(2)}%`, severity: "critical" };
      addAlert(alert.type, alert.message, alert.severity);
    } else if (diff > 8) {
      alert = { type: "RTP_WARNING", message: `WARNING: RTP drifted ${diff.toFixed(2)}% from target (${target}%). Actual: ${actualRtp.toFixed(2)}%`, severity: "warning" };
      addAlert(alert.type, alert.message, alert.severity);
    } else {
      lastAlertMessage = "";
    }
    res.json({ success: true, target, actualRtp, totalBets, diff, alert, alerts: alertHistory.slice(0, 10) });
  } catch (err: any) { next(err); }
};

export const clearAlerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    alertHistory = [];
    lastAlertMessage = "";
    res.json({ success: true, message: "Alerts cleared" });
  } catch (err: any) { next(err); }
};


