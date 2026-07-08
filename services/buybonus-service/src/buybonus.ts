import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const WALLET_URL = process.env.WALLET_URL || "http://localhost:3003";
const RNG_URL = process.env.RNG_URL || "http://localhost:3010";
const SESSION_URL = process.env.SESSION_URL || "http://localhost:3008";

export const BUY_BONUS_COST_MULTIPLIER = 100;

export interface BuyBonusConfig {
  gameId: string;
  costMultiplier: number;
  freeSpinsCount: number;
  minBet: number;
  maxBet: number;
}

const DEFAULT_CONFIG: BuyBonusConfig = {
  gameId: "super-ace",
  costMultiplier: 100,
  freeSpinsCount: 10,
  minBet: 0.1,
  maxBet: 1000,
};

export async function calculateCost(baseBet: number): Promise<number> {
  return baseBet * DEFAULT_CONFIG.costMultiplier;
}

export async function executeBuyBonus(params: {
  playerId: string;
  baseBet: number;
  currency: string;
  clientSeed: string;
}): Promise<{
  success: boolean;
  transactionId: string;
  cost: number;
  freeSpinsAwarded: number;
  serverSeedHash: string;
  message?: string;
}> {
  const { playerId, baseBet, currency, clientSeed } = params;
  
  if (baseBet < DEFAULT_CONFIG.minBet || baseBet > DEFAULT_CONFIG.maxBet) {
    return {
      success: false,
      transactionId: "",
      cost: 0,
      freeSpinsAwarded: 0,
      serverSeedHash: "",
      message: `Bet must be between ${DEFAULT_CONFIG.minBet} and ${DEFAULT_CONFIG.maxBet}`,
    };
  }

  const cost = await calculateCost(baseBet);
  const transactionId = uuidv4();

  try {
    // 1. End any existing session first
    try {
      const existingSession = await axios.get(`${SESSION_URL}/session/player/${playerId}`);
      if (existingSession.data && existingSession.data.sessionId) {
        await axios.delete(`${SESSION_URL}/session/${existingSession.data.sessionId}`);
      }
    } catch {
      // No existing session or already completed — fine to continue
    }

    // 2. Deduct cost from wallet
    const deductRes = await axios.post(`${WALLET_URL}/api/wallet/service/bet`, {
      userId: playerId,
      amount: cost,
    });

    if (!deductRes.data.success) {
      return {
        success: false,
        transactionId,
        cost,
        freeSpinsAwarded: 0,
        serverSeedHash: "",
        message: "Insufficient funds for Buy Bonus",
      };
    }

    // 3. Generate new server seed for bonus round
    const seedRes = await axios.post(`${RNG_URL}/seed`, { playerId });
    const serverSeedHash = seedRes.data.hashedSeed;

    // 4. Create bonus session
    await axios.post(`${SESSION_URL}/session`, {
      playerId,
      gameId: DEFAULT_CONFIG.gameId,
      betAmount: baseBet,
      currency,
      serverSeedHash,
      clientSeed,
    });

    return {
      success: true,
      transactionId,
      cost,
      freeSpinsAwarded: DEFAULT_CONFIG.freeSpinsCount,
      serverSeedHash,
    };

  } catch (error: any) {
    console.error("Buy Bonus error:", error.message);
    
    // Attempt refund
    try {
      await axios.post(`${WALLET_URL}/api/wallet/service/win`, {
        userId: playerId,
        amount: cost,
        reference: "buy_bonus_refund",
      });
    } catch (refundError) {
      console.error("CRITICAL: Buy Bonus refund failed", refundError);
    }

    return {
      success: false,
      transactionId,
      cost,
      freeSpinsAwarded: 0,
      serverSeedHash: "",
      message: "Buy Bonus failed. Refund issued if possible.",
    };
  }
}