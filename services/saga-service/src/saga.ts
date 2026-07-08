import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";

const redis = new Redis({ host: process.env.REDIS_HOST || "localhost", port: 6379 });

const WALLET_URL = process.env.WALLET_URL || "http://wallet-service:3003";
const RNG_URL = process.env.RNG_URL || "http://rng-service:3010";
const GAME_URL = process.env.GAME_URL || "http://game-engine:3002";
const SESSION_URL = process.env.SESSION_URL || "http://session-service:3008";

export interface SpinSaga {
  sagaId: string;
  playerId: string;
  sessionId: string;
  betAmount: number;
  currency: string;
  clientSeed: string;
  reelLengths: number[];
  status: "started" | "bet_deducted" | "spin_generated" | "completed" | "compensating" | "failed";
  result?: { stops: number[]; winAmount: number; nonce: number; };
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

    const deductRes = await axios.post(`${WALLET_URL}/wallet/deduct`, {
      playerId: params.playerId, amount: params.betAmount, currency: params.currency,
      referenceId: sagaId, type: "bet",
    });
    if (!deductRes.data.success) throw new Error("Wallet deduction failed");

    saga.status = "spin_generated";
    await logSaga(saga);

    const spinRes = await axios.post(`${RNG_URL}/spin`, {
      playerId: params.playerId, clientSeed: params.clientSeed, reelLengths: params.reelLengths,
    });
    const { stops, nonce } = spinRes.data;

    const winRes = await axios.post(`${GAME_URL}/calculate-win`, { stops, betAmount: params.betAmount });
    const winAmount = winRes.data.winAmount;

    if (winAmount > 0) {
      await axios.post(`${WALLET_URL}/wallet/credit`, {
        playerId: params.playerId, amount: winAmount, currency: params.currency,
        referenceId: sagaId, type: "win",
      });
    }

    await axios.patch(`${SESSION_URL}/session/${params.sessionId}`, { status: "completed", nonce });

    saga.status = "completed";
    saga.result = { stops, winAmount, nonce };
    await logSaga(saga);
    await axios.post(`${SESSION_URL}/session/${params.sessionId}/unlock`);

    return saga;

  } catch (error: any) {
    const previousStatus = saga.status;
    saga.status = "compensating";
    saga.error = error.message;
    await logSaga(saga);

    try {
      if (previousStatus === "bet_deducted" || previousStatus === "spin_generated") {
        await axios.post(`${WALLET_URL}/wallet/credit`, {
          playerId: params.playerId, amount: params.betAmount, currency: params.currency,
          referenceId: `${sagaId}:refund`, type: "refund",
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


