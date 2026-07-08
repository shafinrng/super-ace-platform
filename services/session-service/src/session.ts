import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";

const redis = new Redis({ host: process.env.REDIS_HOST || "localhost", port: 6379 });

export interface GameSession {
  sessionId: string;
  playerId: string;
  gameId: string;
  status: "idle" | "spinning" | "completed" | "disconnected";
  betAmount: number;
  currency: string;
  startedAt: number;
  lastActivity: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

const SESSION_TTL = 3600;

export async function createSession(
  playerId: string,
  gameId: string,
  betAmount: number,
  currency: string,
  serverSeedHash: string,
  clientSeed: string
): Promise<GameSession> {
  const sessionId = uuidv4();
  const now = Date.now();
  const session: GameSession = {
    sessionId, playerId, gameId, status: "idle", betAmount, currency,
    startedAt: now, lastActivity: now, serverSeedHash, clientSeed, nonce: 0,
  };
  await redis.setex(`session:${sessionId}`, SESSION_TTL, JSON.stringify(session));
  await redis.setex(`player_session:${playerId}`, SESSION_TTL, sessionId);
  return session;
}

export async function getSession(sessionId: string): Promise<GameSession | null> {
  const data = await redis.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

export async function getSessionByPlayer(playerId: string): Promise<GameSession | null> {
  const sessionId = await redis.get(`player_session:${playerId}`);
  if (!sessionId) return null;
  return getSession(sessionId);
}

export async function updateSession(sessionId: string, updates: Partial<GameSession>): Promise<GameSession | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  const updated = { ...session, ...updates, lastActivity: Date.now() };
  await redis.setex(`session:${sessionId}`, SESSION_TTL, JSON.stringify(updated));
  return updated;
}

export async function lockSession(sessionId: string): Promise<boolean> {
  const lockKey = `lock:session:${sessionId}`;
  const acquired = await redis.set(lockKey, "1", "EX", 10, "NX");
  return acquired === "OK";
}

export async function unlockSession(sessionId: string): Promise<void> {
  await redis.del(`lock:session:${sessionId}`);
}

export async function endSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (session) {
    await redis.del(`session:${sessionId}`);
    await redis.del(`player_session:${session.playerId}`);
    await redis.del(`lock:session:${sessionId}`);
  }
}

