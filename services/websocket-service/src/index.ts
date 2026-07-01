import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";
import http from "http";

const PORT = process.env.PORT || 3005;
const REDIS_URL = process.env.REDIS_URL || "redis://:superace123@localhost:6379";
const ACTIVITY_CHANNEL = "game:activity";

const server = http.createServer();
const wss = new WebSocketServer({ server });

const sub = new Redis(REDIS_URL);

const clients = new Map<string, WebSocket>();

function broadcast(message: string) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastOnlineCount() {
  const count = clients.size;
  const msg = JSON.stringify({ type: "ONLINE_COUNT", count });
  broadcast(msg);
  console.log(`📊 Online count: ${count}`);
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const userId = url.searchParams.get("userId") || `anon_${Date.now()}`;

  clients.set(userId, ws);
  console.log(`🔌 Connected: ${userId} (Total: ${clients.size})`);
  broadcastOnlineCount();

  ws.on("close", () => {
    clients.delete(userId);
    console.log(`❌ Disconnected: ${userId} (Total: ${clients.size})`);
    broadcastOnlineCount();
  });

  ws.on("error", (err) => {
    console.error("WS error:", err);
    clients.delete(userId);
    broadcastOnlineCount();
  });
});

sub.subscribe(ACTIVITY_CHANNEL, (err) => {
  if (err) console.error("Redis subscribe error:", err);
  else console.log(`📡 Subscribed to ${ACTIVITY_CHANNEL}`);
});

sub.on("message", (channel, message) => {
  if (channel === ACTIVITY_CHANNEL) {
    try {
      const data = JSON.parse(message);
      broadcast(JSON.stringify(data));
      console.log(`📨 Spin from ${data.userId}: bet=${data.betAmount}, win=${data.winAmount}`);
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  }
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket Service running on port ${PORT}`);
});
