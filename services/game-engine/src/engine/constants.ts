import { Symbol } from "../types/game";
export const REELS = 5;
export const ROWS = 4;
export const SYMBOL_WEIGHTS: Record<Symbol, number> = {
  A: 12, K: 12, Q: 14, J: 14,
  SPADE: 10, HEART: 10, CLUB: 10, DIAMOND: 10,
  GOLDEN: 6, WILD: 4, SCATTER: 3,
};
export const PAYOUTS: Record<Symbol, number[]> = {
  A:       [0, 0, 0.17, 0.51, 0.85],
  K:       [0, 0, 0.13, 0.43, 0.68],
  Q:       [0, 0, 0.10, 0.34, 0.51],
  J:       [0, 0, 0.07, 0.21, 0.34],
  SPADE:   [0, 0, 0.034, 0.10, 0.17],
  HEART:   [0, 0, 0.034, 0.10, 0.17],
  CLUB:    [0, 0, 0.017, 0.051, 0.085],
  DIAMOND: [0, 0, 0.017, 0.051, 0.085],
  GOLDEN:  [0, 0, 0.34, 1.02, 1.70],
  WILD:    [0, 0, 0,    0,   0],
  SCATTER: [0, 0, 0,    0,   0],
};
export const MULTIPLIER_STEPS = [1, 2, 3, 5];
export const FREE_SPIN_MULTIPLIER_STEPS = [2, 4, 6, 10];
export const SCATTER_TRIGGER_COUNT = 3;
export const FREE_SPINS_AWARDED = 10;