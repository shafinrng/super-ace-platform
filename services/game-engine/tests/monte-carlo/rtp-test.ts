/// <reference types="node" />
// services/game-engine/tests/monte-carlo/rtp-test.ts
//
// Standalone RTP verification with a per-symbol contribution breakdown,
// so we can see exactly which symbols/tiers are driving payout instead
// of guessing. Bypasses spin() in SuperAceGame.ts deliberately — that
// function needs Redis/wallet/websocket running, this is pure math.
//
// Run with: npm run test:monte-carlo

import { generateGrid } from "../../src/engine/ReelGenerator";
import { revealGoldenCards } from "../../src/engine/GoldenCard";
import { calculateWins } from "../../src/engine/WinCalculator";
import { runCascades } from "../../src/engine/CascadeEngine";
import { MULTIPLIER_STEPS, SCATTER_TRIGGER_COUNT, FREE_SPINS_AWARDED } from "../../src/engine/constants";
import { Symbol } from "../../src/types/game";

const SPIN_COUNT = 200_000;
const BET_AMOUNT = 1;
const BIAS = 1.0;

function countScatters(grid: Symbol[][]): number {
  return grid.flat().filter((s) => s === "SCATTER").length;
}

function runSimulation() {
  let totalBet = 0;
  let totalWin = 0;
  let freeSpinTriggers = 0;
  let maxSingleWin = 0;
  let winningSpins = 0;

  // Per-symbol contribution tracking — this is the key diagnostic addition
  const symbolPayoutTotals: Record<string, number> = {};
  const symbolWinCounts: Record<string, number> = {};
  const symbolMaxWays: Record<string, number> = {};

  function trackWin(symbol: string, payout: number, ways: number) {
    symbolPayoutTotals[symbol] = (symbolPayoutTotals[symbol] || 0) + payout;
    symbolWinCounts[symbol] = (symbolWinCounts[symbol] || 0) + 1;
    symbolMaxWays[symbol] = Math.max(symbolMaxWays[symbol] || 0, ways);
  }

  for (let i = 0; i < SPIN_COUNT; i++) {
    totalBet += BET_AMOUNT;

    const landedGrid = generateGrid();
    const { revealedGrid: grid } = revealGoldenCards(landedGrid);

    const initialMultiplier = MULTIPLIER_STEPS[0];
    const initialWins = calculateWins(grid, BET_AMOUNT, initialMultiplier, BIAS);
    const cascades = runCascades(grid, BET_AMOUNT, false, BIAS);

    let spinTotal = 0;
    for (const w of initialWins) {
      spinTotal += w.payout;
      trackWin(w.symbol, w.payout, w.positions.length);
    }
    for (const c of cascades) {
      for (const w of c.wins) {
        spinTotal += w.payout;
        trackWin(w.symbol, w.payout, w.positions.length);
      }
    }

    totalWin += spinTotal;
    if (spinTotal > 0) winningSpins++;
    if (spinTotal > maxSingleWin) maxSingleWin = spinTotal;

    const scatterCount = countScatters(grid);
    if (scatterCount >= SCATTER_TRIGGER_COUNT) freeSpinTriggers++;
  }

  const rtp = (totalWin / totalBet) * 100;
  const hitFrequency = (winningSpins / SPIN_COUNT) * 100;
  const freeSpinFrequency = SPIN_COUNT / Math.max(freeSpinTriggers, 1);

  console.log("=".repeat(60));
  console.log("MONTE CARLO RTP SIMULATION RESULTS");
  console.log("=".repeat(60));
  console.log(`Spins simulated:        ${SPIN_COUNT.toLocaleString()}`);
  console.log(`Total wagered:          $${totalBet.toLocaleString()}`);
  console.log(`Total paid out:         $${totalWin.toFixed(2)}`);
  console.log(`Measured RTP:           ${rtp.toFixed(3)}%`);
  console.log(`Hit frequency:          ${hitFrequency.toFixed(2)}% of spins won something`);
  console.log(`Largest single win:     $${maxSingleWin.toFixed(2)} (at $${BET_AMOUNT} bet)`);
  console.log(`Free Spins trigger:     1 in ${freeSpinFrequency.toFixed(0)} spins`);
  console.log("=".repeat(60));
  console.log("PER-SYMBOL CONTRIBUTION TO TOTAL PAYOUT");
  console.log("=".repeat(60));

  const sortedSymbols = Object.keys(symbolPayoutTotals).sort(
    (a, b) => symbolPayoutTotals[b] - symbolPayoutTotals[a]
  );
  for (const sym of sortedSymbols) {
    const pct = (symbolPayoutTotals[sym] / totalWin) * 100;
    console.log(
      `${sym.padEnd(8)} | wins: ${String(symbolWinCounts[sym]).padStart(7)} | total paid: $${symbolPayoutTotals[sym].toFixed(2).padStart(12)} | ${pct.toFixed(1)}% of all payout`
    );
  }

  console.log("=".repeat(60));
  console.log(
    rtp > 90 && rtp < 104
      ? "RTP is in a plausible range for a real slot (typically 90-98%)."
      : "WARNING: RTP is outside a typical real-slot range (90-98%)."
  );
}

runSimulation();