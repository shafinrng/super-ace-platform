import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://:superace123@localhost:6379");
const pub = new Redis(process.env.REDIS_URL || "redis://:superace123@localhost:6379");

const ACTIVITY_CHANNEL = "game:activity";
const ONLINE_KEY = "online:players";

export async function recordSpin(userId: string, username: string, betAmount: number, winAmount: number): Promise<void> {
  const activity = {
    type: "SPIN",
    userId,
    username,
    betAmount,
    winAmount,
    timestamp: new Date().toISOString(),
  };
  await pub.publish(ACTIVITY_CHANNEL, JSON.stringify(activity));
}

export async function playerConnected(userId: string): Promise<void> {
  await redis.sadd(ONLINE_KEY, userId);
  await redis.expire(ONLINE_KEY, 300);
  const count = await redis.scard(ONLINE_KEY);
  await pub.publish(ACTIVITY_CHANNEL, JSON.stringify({ type: "ONLINE_COUNT", count }));
}

export async function playerDisconnected(userId: string): Promise<void> {
  await redis.srem(ONLINE_KEY, userId);
  const count = await redis.scard(ONLINE_KEY);
  await pub.publish(ACTIVITY_CHANNEL, JSON.stringify({ type: "ONLINE_COUNT", count }));
}

export async function getOnlineCount(): Promise<number> {
  return redis.scard(ONLINE_KEY);
}
