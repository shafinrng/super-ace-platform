import { Symbol } from "../types/game";
import { SYMBOL_WEIGHTS, ROWS } from "./constants";

// Fixed, published reel strips — this is what makes provably-fair verification meaningful.
// Built deterministically from SYMBOL_WEIGHTS so the distribution matches game design.
// In production these should be committed to and displayed to players for transparency.
function buildStrip(length: number): Symbol[] {
  const symbols = Object.keys(SYMBOL_WEIGHTS) as Symbol[];
  const strip: Symbol[] = [];
  let i = 0;
  while (strip.length < length) {
    const sym = symbols[i % symbols.length];
    const weight = SYMBOL_WEIGHTS[sym];
    for (let w = 0; w < weight && strip.length < length; w++) strip.push(sym);
    i++;
  }
  // simple fixed shuffle so same symbols are not clustered; deterministic (not Math.random)
  for (let j = strip.length - 1; j > 0; j--) {
    const k = (j * 2654435761) % (j + 1);
    [strip[j], strip[k]] = [strip[k], strip[j]];
  }
  return strip;
}

export const REEL_STRIP_LENGTH = 20;
export const REEL_STRIPS: Symbol[][] = [0, 1, 2, 3, 4].map(() => buildStrip(REEL_STRIP_LENGTH));

export function stopsToGrid(stops: number[]): Symbol[][] {
  return stops.map((stop, reelIndex) => {
    const strip = REEL_STRIPS[reelIndex] || REEL_STRIPS[0];
    const window: Symbol[] = [];
    for (let row = 0; row < ROWS; row++) {
      window.push(strip[(stop + row) % strip.length]);
    }
    return window;
  });
}
