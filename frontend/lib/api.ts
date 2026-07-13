import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const authApi = axios.create({ baseURL: API_BASE });
const walletApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_WALLET_URL || "http://localhost:3003" });
const sessionApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_SESSION_URL || "http://localhost:3008" });
const sagaApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_SAGA_URL || "http://localhost:3009" });
const jackpotApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_JACKPOT_URL || "http://localhost:3011" });

export const login = (email: string, password: string) =>
  authApi.post("/api/auth/login", { email, password });

export const register = (username: string, email: string, password: string) =>
  authApi.post("/api/auth/register", { username, email, password });

export const getBalance = (token: string) =>
  walletApi.get("/api/wallet/balance", { headers: { Authorization: `Bearer ${token}` } });

export const createGameSession = (playerId: string, betAmount: number, clientSeed: string) =>
  sessionApi.post("/session", {
    playerId,
    gameId: "super-ace",
    betAmount,
    currency: "USDT",
    serverSeedHash: "pending",
    clientSeed,
  });

export const spinSaga = (playerId: string, sessionId: string, betAmount: number, clientSeed: string) =>
  sagaApi.post("/saga/spin", {
    playerId,
    sessionId,
    betAmount,
    currency: "USDT",
    clientSeed,
    reelLengths: [20, 20, 20, 20, 20],
  });

export const getJackpots = () => jackpotApi.get("/jackpots");
