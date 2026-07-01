import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://:superace123@localhost:6379");

const RTP_TARGET_KEY = "rtp:target";
const RTP_TOTAL_BETS_KEY = "rtp:totalBets";
const RTP_TOTAL_PAYOUTS_KEY = "rtp:totalPayouts";
const DEFAULT_TARGET_RTP = 96;

export async function getTargetRtp(): Promise<number> {
  const val = await redis.get(RTP_TARGET_KEY);
  return val ? parseFloat(val) : DEFAULT_TARGET_RTP;
}

export async function setTargetRtp(rtp: number): Promise<void> {
  if (rtp < 50 || rtp > 99) throw new Error("RTP must be between 50 and 99");
  await redis.set(RTP_TARGET_KEY, rtp.toString());
}

// Per-player RTP override
export async function getPlayerRtp(userId: string): Promise<number | null> {
  const val = await redis.get(`rtp:player:${userId}`);
  return val ? parseFloat(val) : null;
}

export async function setPlayerRtp(userId: string, rtp: number): Promise<void> {
  if (rtp < 50 || rtp > 99) throw new Error("RTP must be between 50 and 99");
  await redis.set(`rtp:player:${userId}`, rtp.toString());
}

export async function deletePlayerRtp(userId: string): Promise<void> {
  await redis.del(`rtp:player:${userId}`);
}

export async function getAllPlayerRtps(): Promise<{userId: string; rtp: number}[]> {
  const keys = await redis.keys("rtp:player:*");
  if (keys.length === 0) return [];
  const values = await redis.mget(...keys);
  return keys.map((key, i) => ({
    userId: key.replace("rtp:player:", ""),
    rtp: parseFloat(values[i] || "0"),
  }));
}

export async function recordBet(amount: number): Promise<void> {
  await redis.incrbyfloat(RTP_TOTAL_BETS_KEY, amount);
}

export async function recordPayout(amount: number): Promise<void> {
  if (amount > 0) await redis.incrbyfloat(RTP_TOTAL_PAYOUTS_KEY, amount);
}

export async function getActualRtp(): Promise<{ actualRtp: number; totalBets: number; totalPayouts: number }> {
  const [betsStr, payoutsStr] = await Promise.all([
    redis.get(RTP_TOTAL_BETS_KEY),
    redis.get(RTP_TOTAL_PAYOUTS_KEY),
  ]);
  const totalBets = parseFloat(betsStr || "0");
  const totalPayouts = parseFloat(payoutsStr || "0");
  const actualRtp = totalBets > 0 ? (totalPayouts / totalBets) * 100 : 0;
  return { actualRtp, totalBets, totalPayouts };
}

export async function resetRtpStats(): Promise<void> {
  await redis.del(RTP_TOTAL_BETS_KEY, RTP_TOTAL_PAYOUTS_KEY);
}

export async function getRtpBias(userId?: string): Promise<number> {
  let target: number;
  if (userId) {
    const playerRtp = await getPlayerRtp(userId);
    target = playerRtp ?? await getTargetRtp();
  } else {
    target = await getTargetRtp();
  }
  const { actualRtp, totalBets } = await getActualRtp();
  if (totalBets < 100) return 1.0;
  const diff = target - actualRtp;
  const bias = 1.0 + Math.max(-0.5, Math.min(0.5, diff / 40));
  return bias;
}
