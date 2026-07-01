import { Symbol } from "../types/game";
export const REELS = 5;
export const ROWS = 4;
export const SYMBOL_WEIGHTS: Record<Symbol, number> = {
  A: 12, K: 12, Q: 14, J: 14,
  SPADE: 10, HEART: 10, CLUB: 10, DIAMOND: 10,
  GOLDEN: 6, WILD: 4, SCATTER: 3,
};
export const PAYOUTS: Record<Symbol, number[]> = {
  A:       [0, 0, 5,  15,  50],
  K:       [0, 0, 5,  15,  50],
  Q:       [0, 0, 4,  12,  40],
  J:       [0, 0, 4,  12,  40],
  SPADE:   [0, 0, 8,  25,  80],
  HEART:   [0, 0, 8,  25,  80],
  CLUB:    [0, 0, 8,  25,  80],
  DIAMOND: [0, 0, 8,  25,  80],
  GOLDEN:  [0, 0, 15, 50,  150],
  WILD:    [0, 0, 20, 75,  200],
  SCATTER: [0, 0, 2,  10,  50],
};
export const MULTIPLIER_STEPS = [1, 2, 3, 5];
export const FREE_SPIN_MULTIPLIER_STEPS = [2, 4, 6, 10];
export const SCATTER_TRIGGER_COUNT = 3;
export const FREE_SPINS_AWARDED = 10;