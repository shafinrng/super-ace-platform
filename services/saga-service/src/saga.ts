import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";

const redis = new Redis({ host: process.env.REDIS_HOST || "localhost", port: 6379 });

const WALLET_URL = process.env.WALLET_URL || "http://localhost:3003";
const RNG_URL = process.env.RNG_URL || "http://localhost:3010";
const GAME_URL = process.env.GAME_URL || "http://localhost:3002";
const SESSION_URL = process.env.SESSION_URL || "http://localhost:3008";
const JACKPOT_URL = process.env.JACKPOT_URL || "http://localhost:3011";

export interface SpinSaga {
  sagaId: string;
  playerId: string;
  sessionId: string;
  betAmount: number;
  currency: string;
  clientSeed: string;
  reelLengths: number[];
  status: "started" | "bet_deducted" | "spin_generated" | "completed" | "compensating" | "failed";
  result?: {
    stops: number[];
    winAmount: number;
    nonce: number;
    grid?: any;
    wins?: any;
    cascades?: any;
    multiplier?: number;
    freeSpinsAwarded?: number;
    isFreeSpinMode?: boolean;
    jackpot?: { tier: string | null; winAmount: number; triggered: boolean };
  };
  error?: string;
  createdAt: number;
}

async function logSaga(saga: SpinSaga) {
  await redis.setex(`saga:${saga.sagaId}`, 86400, JSON.stringify(saga));
}

export async function getSaga(sagaId: string): Promise<SpinSaga | null> {
  const data = await redis.get(`saga:${sagaId}`);
  return data ? JSON.parse(data) : null;
}

// Ensures a server seed exists for this player before spinning.
// rng-service requires /seed to be called first; safe to call repeatedly (it just regenerates).
async function ensureSeed(playerId: string) {
  await axios.post(`${RNG_URL}/seed`, { playerId });
}

export async function executeSpinSaga(params: {
  playerId: string; sessionId: string; betAmount: number; currency: string;
  clientSeed: string; reelLengths: number[];
}): Promise<SpinSaga> {
  const sagaId = uuidv4();
  const saga: SpinSaga = { sagaId, ...params, status: "started", createdAt: Date.now() };

  try {
    const lockRes = await axios.post(`${SESSION_URL}/session/${params.sessionId}/lock`);
    if (!lockRes.data.acquired) throw new Error("Could not acquire session lock");

    saga.status = "bet_deducted";
    await logSaga(saga);
    const deductRes = await axios.post(`${WALLET_URL}/api/wallet/service/bet`, {
      userId: params.playerId, amount: params.betAmount,
    });
    if (!deductRes.data.success) throw new Error("Wallet deduction failed");

    // Contribute to jackpot pools now that the bet is confirmed taken.
    // Non-critical: if jackpot-service is briefly unavailable, do not fail the whole spin.
    try {
      await axios.post(`${JACKPOT_URL}/jackpots/contribute`, { betAmount: params.betAmount });
    } catch (jpErr) {
      console.error("Jackpot contribution failed (non-fatal):", (jpErr as any).message);
    }

    saga.status = "spin_generated";
    await logSaga(saga);
    await ensureSeed(params.playerId);
    const spinRes = await axios.post(`${RNG_URL}/spin`, {
      playerId: params.playerId, clientSeed: params.clientSeed, reelLengths: params.reelLengths,
    });
    const { stops, nonce } = spinRes.data;

    const winRes = await axios.post(`${GAME_URL}/api/game/calculate-win`, {
      stops, betAmount: params.betAmount, playerId: params.playerId,
    });
    const winAmount = winRes.data.winAmount;
    const fullResult = winRes.data.result || {};

    // Check for a jackpot trigger on this spin (independent of regular symbol wins).
    let jackpotResult: { tier: string | null; winAmount: number; triggered: boolean } = { tier: null, winAmount: 0, triggered: false };
    try {
      const jpRes = await axios.post(`${JACKPOT_URL}/jackpots/check`, {
        playerId: params.playerId, betAmount: params.betAmount, clientSeed: params.clientSeed, nonce,
      });
      jackpotResult = jpRes.data;
    } catch (jpErr) {
      console.error("Jackpot check failed (non-fatal):", (jpErr as any).message);
    }

    const totalCredit = winAmount + (jackpotResult.triggered ? jackpotResult.winAmount : 0);
    if (totalCredit > 0) {
      await axios.post(`${WALLET_URL}/api/wallet/service/win`, {
        userId: params.playerId, amount: totalCredit, reference: sagaId,
      });
    }

    await axios.patch(`${SESSION_URL}/session/${params.sessionId}`, { status: "completed", nonce });

    saga.status = "completed";
    saga.result = { stops, winAmount, nonce, ...fullResult, jackpot: jackpotResult };
    await logSaga(saga);
    await axios.post(`${SESSION_URL}/session/${params.sessionId}/unlock`);
    return saga;
  } catch (error: any) {
    const previousStatus = saga.status;
    saga.status = "compensating";
    saga.error = error.response?.data?.error || error.message;
    await logSaga(saga);

    try {
      if (previousStatus === "bet_deducted" || previousStatus === "spin_generated") {
        await axios.post(`${WALLET_URL}/api/wallet/service/win`, {
          userId: params.playerId, amount: params.betAmount, reference: `${sagaId}:refund`,
        });
      }
    } catch (compError) {
      console.error("CRITICAL: Compensation failed", compError);
      saga.status = "failed";
      await logSaga(saga);
    }

    try { await axios.post(`${SESSION_URL}/session/${params.sessionId}/unlock`); } catch {}

    saga.status = "failed";
    await logSaga(saga);
    return saga;
  }
}
