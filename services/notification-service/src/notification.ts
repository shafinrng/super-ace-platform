import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";
import { Pool } from "pg";

const redis = new Redis({ host: process.env.REDIS_HOST || "localhost", port: 6379 });
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: 5432,
  database: "superace_db",
  user: "superace",
  password: "superace123",
});

// â”€â”€ Ensure tables exist â”€â”€
export async function initDB(): Promise<void> {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT,
      type VARCHAR(50) NOT NULL,
      sub_type VARCHAR(50),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
  `);
}

export type ToastType = "info" | "success" | "warning" | "error";
export type WinTier = "big" | "mega" | "super";
export type AdminLevel = "info" | "warning" | "critical";

export interface ToastPayload {
  userId: string;
  toastType: ToastType;
  title: string;
  message: string;
  durationMs: number;
  actionUrl?: string;
}

export interface WinPayload {
  userId: string;
  betAmount: number;
  winAmount: number;
  currency: string;
  gameId: string;
}

export interface SMSPayload {
  phoneNumber: string;
  template: "password_reset" | "withdrawal_otp" | "big_win_alert";
  vars: Record<string, string>;
}

export interface AdminAlertPayload {
  level: AdminLevel;
  category: "jackpot" | "system_error" | "security" | "fraud";
  message: string;
  metadata: Record<string, any>;
}

export interface ScheduledPayload {
  userId: string;
  type: "toast" | "win" | "sms";
  payload: any;
  deliverAt: Date;
}

// â”€â”€ Win Classification â”€â”€
export function classifyWin(betAmount: number, winAmount: number): WinTier | null {
  if (betAmount <= 0) return null;
  const multiplier = winAmount / betAmount;
  if (multiplier >= 100) return "super";
  if (multiplier >= 50) return "mega";
  if (multiplier >= 10) return "big";
  return null;
}

// â”€â”€ Persist & Broadcast â”€â”€
export async function sendToast(data: ToastPayload): Promise<string> {
  const id = uuidv4();
  await pgPool.query(
    `INSERT INTO notifications (id, user_id, type, sub_type, title, message, metadata, expires_at)
     VALUES ($1, $2, 'toast', $3, $4, $5, $6, NOW() + INTERVAL '24 hours')`,
    [id, data.userId, data.toastType, data.title, data.message, JSON.stringify({ durationMs: data.durationMs, actionUrl: data.actionUrl })]
  );
  
  await redis.publish(`user:${data.userId}:notifications`, JSON.stringify({
    event: "toast", id, toastType: data.toastType, title: data.title,
    message: data.message, durationMs: data.durationMs, actionUrl: data.actionUrl,
  }));
  
  return id;
}

export async function sendWinAnimation(data: WinPayload): Promise<{ id: string; tier: WinTier | null }> {
  const tier = classifyWin(data.betAmount, data.winAmount);
  if (!tier) return { id: "", tier: null }; // Not big enough
  
  const id = uuidv4();
  const title = tier === "super" ? "SUPER WIN!" : tier === "mega" ? "MEGA WIN!" : "BIG WIN!";
  
  await pgPool.query(
    `INSERT INTO notifications (id, user_id, type, sub_type, title, message, metadata)
     VALUES ($1, $2, 'win', $3, $4, $5, $6)`,
    [id, data.userId, tier, title, `${data.winAmount} ${data.currency}`,
     JSON.stringify({ betAmount: data.betAmount, winAmount: data.winAmount, currency: data.currency, gameId: data.gameId })]
  );
  
  await redis.publish(`user:${data.userId}:notifications`, JSON.stringify({
    event: "win_animation", id, tier, title,
    amount: data.winAmount, currency: data.currency,
    betAmount: data.betAmount, gameId: data.gameId,
  }));
  
  // Also publish to admin channel for monitoring
  await redis.publish("admin:jackpot_wins", JSON.stringify({
    userId: data.userId, tier, amount: data.winAmount, currency: data.currency, gameId: data.gameId, timestamp: new Date().toISOString(),
  }));
  
  return { id, tier };
}

export async function sendAdminAlert(data: AdminAlertPayload): Promise<string> {
  const id = uuidv4();
  await pgPool.query(
    `INSERT INTO notifications (id, type, sub_type, title, message, metadata)
     VALUES ($1, 'admin', $2, $3, $4, $5)`,
    [id, data.category, `[${data.level.toUpperCase()}] ${data.category}`, data.message, JSON.stringify(data.metadata)]
  );
  
  await redis.publish("admin:alerts", JSON.stringify({
    event: "admin_alert", id, level: data.level, category: data.category,
    message: data.message, metadata: data.metadata, timestamp: new Date().toISOString(),
  }));
  
  return id;
}

// â”€â”€ SMS (Twilio) â”€â”€
export async function sendSMS(data: SMSPayload): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const accountSid = process.env.TWILIO_SID;
    const authToken = process.env.TWILIO_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE;
    
    if (!accountSid || !authToken || !fromNumber) {
      console.warn("Twilio not configured. SMS skipped.");
      return { success: false, error: "Twilio not configured" };
    }
    
    const twilio = require("twilio")(accountSid, authToken);
    
    const templates: Record<string, string> = {
      password_reset: "Your SuperAce password reset code: {{CODE}}. Valid for 10 minutes.",
      withdrawal_otp: "SuperAce withdrawal verification: {{CODE}}. Amount: {{AMOUNT}} {{CURRENCY}}",
      big_win_alert: "Congratulations! You won {{AMOUNT}} {{CURRENCY}} on SuperAce!",
    };
    
    let body = templates[data.template];
    for (const [key, val] of Object.entries(data.vars)) {
      body = body.replace(`{{${key}}}`, val);
    }
    
    const message = await twilio.messages.create({
      body,
      from: fromNumber,
      to: data.phoneNumber,
    });
    
    return { success: true, sid: message.sid };
  } catch (err: any) {
    console.error("SMS failed:", err.message);
    return { success: false, error: err.message };
  }
}

// â”€â”€ Scheduled / Delayed â”€â”€
export async function scheduleNotification(data: ScheduledPayload): Promise<string> {
  const id = uuidv4();
  const delayMs = new Date(data.deliverAt).getTime() - Date.now();
  
  if (delayMs <= 0) {
    // Deliver immediately
    if (data.type === "toast") await sendToast(data.payload);
    if (data.type === "win") await sendWinAnimation(data.payload);
    return id;
  }
  
  // Store in Redis with TTL; a worker would pick it up. For now, simple set + publish
  await redis.setex(`scheduled:${id}`, Math.ceil(delayMs / 1000), JSON.stringify(data));
  
  // In production, use Bull queue with delayed jobs
  return id;
}

// â”€â”€ History / Inbox â”€â”€
export async function getUserNotifications(userId: string, limit: number = 50, unreadOnly: boolean = false): Promise<any[]> {
  const query = unreadOnly
    ? `SELECT * FROM notifications WHERE user_id = $1 AND is_read = FALSE ORDER BY created_at DESC LIMIT $2`
    : `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`;
    
  const result = await pgPool.query(query, [userId, limit]);
  return result.rows;
}

export async function markRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await pgPool.query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id`,
    [notificationId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await pgPool.query(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function getAdminAlerts(limit: number = 50): Promise<any[]> {
  const result = await pgPool.query(
    `SELECT * FROM notifications WHERE type = 'admin' ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}