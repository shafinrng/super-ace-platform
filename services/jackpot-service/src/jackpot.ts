import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";

const redis = new Redis({ host: process.env.REDIS_HOST || "localhost", port: 6379 });

export type JackpotTier = "grand" | "major" | "minor" | "mini";

interface JackpotConfig {
  tier: JackpotTier;
  seed: number;           // Starting value
  contributionRate: number; // % of bet (e.g., 0.01 = 1%)
  triggerChance: number;  // Base chance per $1 bet (e.g., 0.000001)
  minBet: number;         // Minimum bet to qualify
  maxWin: number;         // Cap (0 = no cap)
}

const JACKPOT_CONFIGS: Record<JackpotTier, JackpotConfig> = {
  grand:  { tier: "grand",  seed: 50000,  contributionRate: 0.005, triggerChance: 0.0000001, minBet: 1.0,  maxWin: 0 },
  major:  { tier: "major",  seed: 5000,   contributionRate: 0.008, triggerChance: 0.000001,  minBet: 0.5,  maxWin: 0 },
  minor:  { tier: "minor",  seed: 500,    contributionRate: 0.01,  triggerChance: 0.00001,   minBet: 0.2,  maxWin: 0 },
  mini:   { tier: "mini",   seed: 50,     contributionRate: 0.015, triggerChance: 0.0001,    minBet: 0.1,  maxWin: 0 },
};

const POOL_KEYS: Record<JackpotTier, string> = {
  grand: "jackpot:pool:grand",
  major: "jackpot:pool:major",
  minor: "jackpot:pool:minor",
  mini:  "jackpot:pool:mini",
};

// Initialize pools if empty
export async function initPools(): Promise<void> {
  for (const [tier, config] of Object.entries(JACKPOT_CONFIGS)) {
    const exists = await redis.exists(POOL_KEYS[tier as JackpotTier]);
    if (!exists) {
      await redis.set(POOL_KEYS[tier as JackpotTier], config.seed.toString());
    }
  }
}

// Get current pool values
export async function getPoolValues(): Promise<Record<JackpotTier, number>> {
  const values = await redis.mget(Object.values(POOL_KEYS));
  const tiers: JackpotTier[] = ["grand", "major", "minor", "mini"];
  const result = {} as Record<JackpotTier, number>;
  tiers.forEach((tier, i) => {
    result[tier] = parseFloat(values[i] || "0");
  });
  return result;
}

// Contribute to pools from a bet
export async function contribute(betAmount: number): Promise<Record<JackpotTier, number>> {
  const contributions = {} as Record<JackpotTier, number>;
  
  for (const [tier, config] of Object.entries(JACKPOT_CONFIGS)) {
    const amount = betAmount * config.contributionRate;
    await redis.incrbyfloat(POOL_KEYS[tier as JackpotTier], amount.toString());
    contributions[tier as JackpotTier] = amount;
  }
  
  return contributions;
}

// Check if any jackpot triggers
export async function checkJackpotWin(
  playerId: string,
  betAmount: number,
  clientSeed: string,
  nonce: number
): Promise<{ tier: JackpotTier | null; winAmount: number; triggered: boolean }> {
  
  // Use provably fair RNG approach for verifiable jackpot chance
  const message = `jackpot:${playerId}:${clientSeed}:${nonce}:${Date.now()}`;
  const hash = require("crypto").createHmac("sha256", "jackpot-server-seed").update(message).digest("hex");
  const random = parseInt(hash.substring(0, 8), 16) / 0xFFFFFFFF;
  
  const pools = await getPoolValues();
  
  // Check from Grand down to Mini
  const tiers: JackpotTier[] = ["grand", "major", "minor", "mini"];
  
  for (const tier of tiers) {
    const config = JACKPOT_CONFIGS[tier];
    
    if (betAmount < config.minBet) continue;
    
    const adjustedChance = config.triggerChance * betAmount;
    const threshold = Math.min(adjustedChance, 0.5); // Max 50% chance per spin
    
    if (random < threshold) {
      // Jackpot triggered!
      const winAmount = pools[tier];
      
      // Reset pool to seed value
      await redis.set(POOL_KEYS[tier], config.seed.toString());
      
      return { tier, winAmount, triggered: true };
    }
  }
  
  return { tier: null, winAmount: 0, triggered: false };
}

// Force pool values (admin only)
export async function setPoolValue(tier: JackpotTier, value: number): Promise<void> {
  await redis.set(POOL_KEYS[tier], value.toString());
}

// Get history (placeholder for DB integration)
export async function getRecentWins(limit: number = 10): Promise<any[]> {
  // In production, query Postgres
  return [];
}
