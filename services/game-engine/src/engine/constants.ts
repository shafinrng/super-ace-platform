import { Symbol } from "../types/game";
export const REELS = 5;
export const ROWS = 4;
export const SYMBOL_WEIGHTS: Record<Symbol, number> = {
  A: 12, K: 12, Q: 14, J: 14,
  SPADE: 10, HEART: 10, CLUB: 10, DIAMOND: 10,
  GOLDEN: 6, WILD: 4, SCATTER: 3,
};
export const PAYOUTS: Record<Symbol, number[]> = {
  A:       [0, 0, 0.0086, 0.0258, 0.0430, 0.0859],
  K:       [0, 0, 0.0066, 0.0218, 0.0344, 0.0687],
  Q:       [0, 0, 0.0051, 0.0171, 0.0258, 0.0516],
  J:       [0, 0, 0.0036, 0.0106, 0.0171, 0.0344],
  SPADE:   [0, 0, 0.0017, 0.0051, 0.0086, 0.0171],
  HEART:   [0, 0, 0.0017, 0.0051, 0.0086, 0.0171],
  CLUB:    [0, 0, 0.0009, 0.0026, 0.0043, 0.0086],
  DIAMOND: [0, 0, 0.0009, 0.0026, 0.0043, 0.0086],
  GOLDEN:  [0, 0, 0.0171, 0.0516, 0.0859, 0.1719],
  WILD:    [0, 0, 0,      0,      0,      0],
  SCATTER: [0, 0, 0,      0,      0,      0],
};
export const MULTIPLIER_STEPS = [1, 2, 3, 5];
export const FREE_SPIN_MULTIPLIER_STEPS = [2, 4, 6, 10];
export const SCATTER_TRIGGER_COUNT = 3;
export const FREE_SPINS_AWARDED = 10;