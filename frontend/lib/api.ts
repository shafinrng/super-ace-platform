import axios from "axios";

const authApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });
const gameApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_GAME_URL });
const walletApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_WALLET_URL });

export const login = (email: string, password: string) =>
  authApi.post("/api/auth/login", { email, password });

export const register = (username: string, email: string, password: string) =>
  authApi.post("/api/auth/register", { username, email, password });

export const getBalance = (token: string) =>
  walletApi.get("/api/wallet/balance", { headers: { Authorization: `Bearer ${token}` } });

export const placeBet = (token: string, amount: number) =>
  walletApi.post("/api/wallet/bet", { amount }, { headers: { Authorization: `Bearer ${token}` } });

export const creditWin = (token: string, amount: number, reference: string) =>
  walletApi.post("/api/wallet/win", { amount, reference }, { headers: { Authorization: `Bearer ${token}` } });

export const spinGame = (token: string, betAmount: number, isFreeSpinMode: boolean, userId: string) =>
  gameApi.post("/api/game/spin", { userId, betAmount, isFreeSpinMode }, { headers: { Authorization: `Bearer ${token}` } });


const sagaApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_SAGA_URL || "http://localhost:3009" });
const sessionApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_SESSION_URL || "http://localhost:3008" });

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

const jackpotApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_JACKPOT_URL || "http://localhost:3011" });

export const getJackpots = () => jackpotApi.get("/jackpots");