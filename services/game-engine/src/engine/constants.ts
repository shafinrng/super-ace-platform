import { Symbol } from "../types/game";
export const REELS = 5;
export const ROWS = 4;
export const SYMBOL_WEIGHTS: Record<Symbol, number> = {
  A: 12, K: 12, Q: 14, J: 14,
  SPADE: 10, HEART: 10, CLUB: 10, DIAMOND: 10,
  GOLDEN: 6, WILD: 4, SCATTER: 3,
};
export const PAYOUTS: Record<Symbol, number[]> = {
  A:       [0, 0, 0.0118, 0.0355, 0.0592, 0.1183],
  K:       [0, 0, 0.0091, 0.0300, 0.0474, 0.0946],
  Q:       [0, 0, 0.0070, 0.0236, 0.0355, 0.0710],
  J:       [0, 0, 0.0049, 0.0146, 0.0236, 0.0474],
  SPADE:   [0, 0, 0.0024, 0.0070, 0.0118, 0.0236],
  HEART:   [0, 0, 0.0024, 0.0070, 0.0118, 0.0236],
  CLUB:    [0, 0, 0.0012, 0.0036, 0.0059, 0.0118],
  DIAMOND: [0, 0, 0.0012, 0.0036, 0.0059, 0.0118],
  GOLDEN:  [0, 0, 0.0236, 0.0710, 0.1183, 0.2367],
  WILD:    [0, 0, 0,      0,      0,      0],
  SCATTER: [0, 0, 0,      0,      0,      0],
};
export const MULTIPLIER_STEPS = [1, 2, 3, 5];
export const FREE_SPIN_MULTIPLIER_STEPS = [2, 4, 6, 10];
export const SCATTER_TRIGGER_COUNT = 3;
export const FREE_SPINS_AWARDED = 10;