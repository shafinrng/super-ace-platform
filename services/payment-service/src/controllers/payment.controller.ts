import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { AuthRequest } from "../middleware/auth";
import { createBinanceOrder, queryBinanceOrder } from "../services/binance";
const prisma = new PrismaClient();
const WALLET_URL = process.env.WALLET_SERVICE_URL || "http://localhost:3003";
const IS_TEST = !process.env.BINANCE_API_KEY || process.env.BINANCE_API_KEY === "your_binance_api_key_here";

export const createDeposit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, currency = "USDT" } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ error: "Minimum deposit is 1 USDT" });
    if (amount > 50000) return res.status(400).json({ error: "Maximum deposit is 50000 USDT" });
    const merchantTradeNo = `DEP${uuidv4().replace(/-/g,"").slice(0,18).toUpperCase()}`;
    const payment = await prisma.payment.create({
      data: { userId: req.user!.id, type: "DEPOSIT", amount, currency, status: "PENDING", binanceOrderId: merchantTradeNo }
    });
    if (IS_TEST) {
      return res.json({
        success: true, paymentId: payment.id, merchantTradeNo, mode: "TEST",
        message: "Test mode - configure real Binance keys for production",
        mockQrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${merchantTradeNo}`,
        amount, currency,
      });
    }
    const result = await createBinanceOrder({ merchantTradeNo, orderAmount: amount, currency, description: `Super Ace deposit ${amount} ${currency}`, userId: req.user!.id });
    if (result.status !== "SUCCESS") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      return res.status(400).json({ error: "Binance order failed" });
    }
    await prisma.payment.update({ where: { id: payment.id }, data: { prepayId: result.data?.prepayId, qrCode: result.data?.qrcodeLink, expireTime: new Date(Date.now() + 30*60*1000) } });
    res.json({ success: true, paymentId: payment.id, qrCode: result.data?.qrcodeLink, deepLink: result.data?.checkoutUrl, amount, currency });
  } catch (err: any) { next(err); }
};

export const checkPaymentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await prisma.payment.findFirst({ where: { id: String(req.params.paymentId), userId: req.user!.id } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.status === "COMPLETED" || IS_TEST) return res.json({ success: true, status: payment.status, payment });
    if (payment.binanceOrderId) {
      const result = await queryBinanceOrder(payment.binanceOrderId);
      if (result.data?.status === "PAID") {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "COMPLETED", completedAt: new Date() } });
        await axios.post(`${WALLET_URL}/api/wallet/win`, { amount: Number(payment.amount), reference: payment.id }, { headers: { Authorization: req.headers.authorization } });
        return res.json({ success: true, status: "COMPLETED", payment });
      }
    }
    res.json({ success: true, status: payment.status, payment });
  } catch (err: any) { next(err); }
};

export const createWithdrawal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, walletAddress, currency = "USDT" } = req.body;
    if (!amount || amount < 10) return res.status(400).json({ error: "Minimum withdrawal is 10 USDT" });
    if (!walletAddress) return res.status(400).json({ error: "Wallet address required" });
    const balRes = await axios.get(`${WALLET_URL}/api/wallet/balance`, { headers: { Authorization: req.headers.authorization } });
    if (Number(balRes.data.balance) < amount) return res.status(400).json({ error: "Insufficient balance" });
    await axios.post(`${WALLET_URL}/api/wallet/bet`, { amount }, { headers: { Authorization: req.headers.authorization } });
    const payment = await prisma.payment.create({
      data: { userId: req.user!.id, type: "WITHDRAWAL", amount, currency, status: "PROCESSING", walletAddress }
    });
    res.json({ success: true, paymentId: payment.id, status: "PROCESSING", message: "Withdrawal submitted. Processing within 24 hours.", amount, walletAddress });
  } catch (err: any) { next(err); }
};

export const getPaymentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 50 });
    res.json({ success: true, payments });
  } catch (err: any) { next(err); }
};

export const handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    if (body.bizType === "PAY" && body.bizStatus === "PAY_SUCCESS") {
      const payment = await prisma.payment.findFirst({ where: { binanceOrderId: body.data?.merchantTradeNo, status: "PENDING" } });
      if (payment) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      }
    }
    res.json({ returnCode: "SUCCESS", returnMessage: null });
  } catch (err: any) { next(err); }
};
