import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import Redis from "ioredis";
import {
  initDB, sendToast, sendWinAnimation, sendSMS, sendAdminAlert,
  scheduleNotification, getUserNotifications, markRead, getUnreadCount,
  getAdminAlerts, ToastPayload, WinPayload, SMSPayload, AdminAlertPayload,
  ScheduledPayload,
} from "./notification";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

// ── WebSocket Connections ──
const clients = new Map<string, WebSocket>(); // userId -> ws
const adminClients = new Set<WebSocket>();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const userId = url.searchParams.get("userId");
  const isAdmin = url.searchParams.get("admin") === "true";
  
  if (isAdmin) {
    adminClients.add(ws);
    ws.send(JSON.stringify({ event: "connected", role: "admin" }));
  } else if (userId) {
    clients.set(userId, ws);
    ws.send(JSON.stringify({ event: "connected", userId }));
    
    // Send unread count immediately
    getUnreadCount(userId).then(count => {
      ws.send(JSON.stringify({ event: "unread_count", count }));
    });
  } else {
    ws.close(1008, "Missing userId or admin flag");
    return;
  }
  
  ws.on("close", () => {
    if (isAdmin) adminClients.delete(ws);
    else if (userId) clients.delete(userId);
  });
  
  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.action === "mark_read" && userId) {
        await markRead(msg.notificationId, userId);
        const count = await getUnreadCount(userId);
        ws.send(JSON.stringify({ event: "unread_count", count }));
      }
    } catch {}
  });
});

// ── Redis Subscribers for cross-service broadcasting ──
const sub = new Redis({ host: process.env.REDIS_HOST || "localhost", port: 6379 });

sub.on("message", (channel, message) => {
  const data = JSON.parse(message);
  
  if (channel.startsWith("user:") && channel.endsWith(":notifications")) {
    const userId = channel.split(":")[1];
    const ws = clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  } else if (channel === "admin:alerts" || channel === "admin:jackpot_wins") {
    adminClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    });
  }
});

sub.subscribe("admin:alerts", "admin:jackpot_wins");
sub.psubscribe("user:*:notifications");

// ── HTTP Routes ──

// Toast (Deposit, Withdraw, General)
app.post("/notify/toast", async (req, res) => {
  try {
    const payload: ToastPayload = req.body;
    if (!payload.userId || !payload.message) {
      return res.status(400).json({ error: "userId and message required" });
    }
    const id = await sendToast(payload);
    res.json({ success: true, id });
  } catch (err) { console.error(err); res.status(500).json({ error: "Toast failed" }); }
});

// Win Animation (Big/Mega/Super)
app.post("/notify/win", async (req, res) => {
  try {
    const payload: WinPayload = req.body;
    if (!payload.userId || !payload.winAmount) {
      return res.status(400).json({ error: "userId and winAmount required" });
    }
    const result = await sendWinAnimation(payload);
    if (!result.tier) return res.json({ success: false, reason: "Below win threshold" });
    res.json({ success: true, id: result.id, tier: result.tier });
  } catch (err) { console.error(err); res.status(500).json({ error: "Win notification failed" }); }
});

// SMS (Password Reset only for now)
app.post("/notify/sms", async (req, res) => {
  try {
    const payload: SMSPayload = req.body;
    if (!payload.phoneNumber || !payload.template) {
      return res.status(400).json({ error: "phoneNumber and template required" });
    }
    const result = await sendSMS(payload);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: "SMS failed" }); }
});

// Admin Alert
app.post("/notify/admin", async (req, res) => {
  try {
    const payload: AdminAlertPayload = req.body;
    if (!payload.message || !payload.category) {
      return res.status(400).json({ error: "message and category required" });
    }
    const id = await sendAdminAlert(payload);
    res.json({ success: true, id });
  } catch (err) { console.error(err); res.status(500).json({ error: "Admin alert failed" }); }
});

// Schedule Notification
app.post("/notify/schedule", async (req, res) => {
  try {
    const payload: ScheduledPayload = req.body;
    if (!payload.userId || !payload.deliverAt) {
      return res.status(400).json({ error: "userId and deliverAt required" });
    }
    const id = await scheduleNotification(payload);
    res.json({ success: true, id });
  } catch (err) { console.error(err); res.status(500).json({ error: "Schedule failed" }); }
});

// ── Inbox / History ──
app.get("/notifications/:userId", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unread === "true";
    const notifications = await getUserNotifications(req.params.userId, limit, unreadOnly);
    res.json({ success: true, notifications, count: notifications.length });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to fetch notifications" }); }
});

app.get("/notifications/:userId/unread-count", async (req, res) => {
  try {
    const count = await getUnreadCount(req.params.userId);
    res.json({ success: true, count });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/notifications/:userId/read/:notificationId", async (req, res) => {
  try {
    const success = await markRead(req.params.notificationId, req.params.userId);
    res.json({ success });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// Admin: Get all alerts
app.get("/admin/alerts", async (_req, res) => {
  try {
    const alerts = await getAdminAlerts(50);
    res.json({ success: true, alerts });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// Health
app.get("/health", (_req, res) => res.json({ status: "ok", service: "notification-service" }));

// Init DB then start
initDB().then(() => {
  const PORT = process.env.PORT || 3013;
  server.listen(PORT, () => console.log(`Notification Service running on port ${PORT} (HTTP + WS)`));
});