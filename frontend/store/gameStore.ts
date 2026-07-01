import { create } from "zustand";

interface GameState {
  balance: number;
  betAmount: number;
  isSpinning: boolean;
  isFreeSpinMode: boolean;
  freeSpinsLeft: number;
  multiplier: number;
  lastWin: number;
  grid: string[][];
  onlinePlayers: number;
  jackpots: { grand: number; major: number; minor: number; mini: number };
  token: string | null;
  username: string | null;
  setBalance: (balance: number | ((b: number) => number)) => void;
  setBetAmount: (bet: number) => void;
  setSpinning: (spinning: boolean) => void;
  setLastWin: (win: number) => void;
  setGrid: (grid: string[][]) => void;
  setToken: (token: string) => void;
  setUsername: (username: string) => void;
  setOnlinePlayers: (count: number) => void;
  setJackpots: (jackpots: any) => void;
  setMultiplier: (multiplier: number) => void;
  setFreeSpinMode: (mode: boolean, spins?: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  balance: 0,
  betAmount: 1,
  isSpinning: false,
  isFreeSpinMode: false,
  freeSpinsLeft: 0,
  multiplier: 1,
  lastWin: 0,
  grid: [],
  onlinePlayers: 0,
  jackpots: { grand: 50000, major: 5000, minor: 500, mini: 50 },
  token: null,
  username: null,
  setBalance: (balance) => set((state) => ({ balance: typeof balance === "function" ? balance(state.balance) : balance })),
  setBetAmount: (betAmount) => set({ betAmount }),
  setSpinning: (isSpinning) => set({ isSpinning }),
  setLastWin: (lastWin) => set({ lastWin }),
  setGrid: (grid) => set({ grid }),
  setToken: (token) => set({ token }),
  setUsername: (username) => set({ username }),
  setOnlinePlayers: (onlinePlayers) => set({ onlinePlayers }),
  setJackpots: (jackpots) => set((state) => ({ jackpots: { ...state.jackpots, ...jackpots } })),
  setMultiplier: (multiplier) => set({ multiplier }),
  setFreeSpinMode: (isFreeSpinMode, freeSpinsLeft = 0) => set({ isFreeSpinMode, freeSpinsLeft }),
}));
