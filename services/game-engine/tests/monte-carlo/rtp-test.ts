/// <reference types="node" />
// services/game-engine/tests/monte-carlo/rtp-test.ts
//
// Extended to simulate Free Spins bonus rounds. Modeling rule that matters:
// free spins cost nothing (no bet deduction — see saga.ts), so only the
// TRIGGERING base spin counts toward total wagered. Every dollar won during
// the bonus round still counts toward total paid out. Get this backwards
// and the RTP number is meaningless.
//
// Matches actual player-facing behavior: retriggers (3+ scatters landing
// DURING a free spin) are intentionally NOT awarded extra spins, mirroring
// the frontend's `!isFreeSpin` guard in page.tsx. If that ever changes in
// the product, this simulation must change with it or it will understate
// real RTP.
//
// Run with: npm run test:monte-carlo

import { generateGrid } from "../../src/engine/ReelGenerator";
import { revealGoldenCards } from "../../src/engine/GoldenCard";
import { calculateWins } from "../../src/engine/WinCalculator";
import { runCascades } from "../../src/engine/CascadeEngine";
import {
  MULTIPLIER_STEPS,
  FREE_SPIN_MULTIPLIER_STEPS,
  SCATTER_TRIGGER_COUNT,
  FREE_SPINS_AWARDED,
} from "../../src/engine/constants";
import { Symbol } from "../../src/types/game";

const SPIN_COUNT = 200_000;
const BET_AMOUNT = 1;
const BIAS = 1.0;

function countScatters(grid: Symbol[][]): number {
  return grid.flat().filter((s) => s === "SCATTER").length;
}

// Runs a single spin's full win evaluation (initial + cascades) and returns
// the total payout. Shared by both base spins and free spins — the only
// difference between them is which multiplier table gets used, which
// runCascades already handles via the isFreeSpinMode flag.
function evaluateSpin(isFreeSpinMode: boolean): { grid: Symbol[][]; totalWin: number } {
  const landedGrid = generateGrid();
  const { revealedGrid: grid } = revealGoldenCards(landedGrid);

  const initialMultiplier = isFreeSpinMode ? FREE_SPIN_MULTIPLIER_STEPS[0] : MULTIPLIER_STEPS[0];
  const initialWins = calculateWins(grid, BET_AMOUNT, initialMultiplier, BIAS);
  const cascades = runCascades(grid, BET_AMOUNT, isFreeSpinMode, BIAS);

  const initialWinAmount = initialWins.reduce((sum, w) => sum + w.payout, 0);
  const cascadeWinAmount = cascades.reduce(
    (sum, c) => sum + c.wins.reduce((s, w) => s + w.payout, 0),
    0
  );

  return { grid, totalWin: initialWinAmount + cascadeWinAmount };
}

function runSimulation() {
  let totalWagered = 0;
  let totalBaseWin = 0;
  let totalFreeSpinWin = 0;
  let bonusRoundsTriggered = 0;
  let winningSpins = 0;
  let maxSingleSpinWin = 0;
  let maxBonusRoundWin = 0;

  for (let i = 0; i < SPIN_COUNT; i++) {
    totalWagered += BET_AMOUNT; // only the base spin is ever actually wagered

    const { grid, totalWin: baseWin } = evaluateSpin(false);
    totalBaseWin += baseWin;
    if (baseWin > 0) winningSpins++;
    if (baseWin > maxSingleSpinWin) maxSingleSpinWin = baseWin;

    const scatterCount = countScatters(grid);
    if (scatterCount >= SCATTER_TRIGGER_COUNT) {
      bonusRoundsTriggered++;
      let bonusRoundWin = 0;

      // Retriggers intentionally not awarded — matches frontend behavior.
      for (let f = 0; f < FREE_SPINS_AWARDED; f++) {
        const { totalWin: freeSpinWin } = evaluateSpin(true);
        bonusRoundWin += freeSpinWin;
      }

      totalFreeSpinWin += bonusRoundWin;
      if (bonusRoundWin > maxBonusRoundWin) maxBonusRoundWin = bonusRoundWin;
    }
  }

  const totalPaid = totalBaseWin + totalFreeSpinWin;
  const rtp = (totalPaid / totalWagered) * 100;
  const baseRtpContribution = (totalBaseWin / totalWagered) * 100;
  const freeSpinRtpContribution = (totalFreeSpinWin / totalWagered) * 100;
  const hitFrequency = (winningSpins / SPIN_COUNT) * 100;
  const bonusFrequency = SPIN_COUNT / Math.max(bonusRoundsTriggered, 1);
  const avgBonusRoundWin = totalFreeSpinWin / Math.max(bonusRoundsTriggered, 1);

  console.log("=".repeat(60));
  console.log("MONTE CARLO RTP SIMULATION — BASE GAME + FREE SPINS");
  console.log("=".repeat(60));
  console.log(`Base spins simulated:      ${SPIN_COUNT.toLocaleString()}`);
  console.log(`Total wagered:             $${totalWagered.toLocaleString()}`);
  console.log(`Total paid (base game):    $${totalBaseWin.toFixed(2)}`);
  console.log(`Total paid (free spins):   $${totalFreeSpinWin.toFixed(2)}`);
  console.log(`Total paid (combined):     $${totalPaid.toFixed(2)}`);
  console.log("-".repeat(60));
  console.log(`COMBINED RTP:              ${rtp.toFixed(3)}%`);
  console.log(`  - base game contributes: ${baseRtpContribution.toFixed(3)}%`);
  console.log(`  - free spins contribute: ${freeSpinRtpContribution.toFixed(3)}%`);
  console.log("-".repeat(60));
  console.log(`Base game hit frequency:   ${hitFrequency.toFixed(2)}% of spins won something`);
  console.log(`Bonus round trigger rate:  1 in ${bonusFrequency.toFixed(0)} spins`);
  console.log(`Bonus rounds simulated:    ${bonusRoundsTriggered.toLocaleString()}`);
  console.log(`Avg win per bonus round:   $${avgBonusRoundWin.toFixed(2)} (at $${BET_AMOUNT} bet, ${FREE_SPINS_AWARDED} spins/round)`);
  console.log(`Largest single base win:   $${maxSingleSpinWin.toFixed(2)}`);
  console.log(`Largest bonus round win:   $${maxBonusRoundWin.toFixed(2)}`);
  console.log("=".repeat(60));
  console.log(
    rtp > 90 && rtp < 104
      ? "RTP is in a plausible range for a real slot (typically 90-98%)."
      : "WARNING: RTP is outside a typical real-slot range (90-98%) — free spins may need rebalancing (see contribution breakdown above)."
  );
}

runSimulation();