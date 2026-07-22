import { SpinRequest, SpinResult, Symbol } from "../types/game";
import { generateGrid } from "./ReelGenerator";
import { calculateWins } from "./WinCalculator";
import { runCascades } from "./CascadeEngine";
import { SCATTER_TRIGGER_COUNT, FREE_SPINS_AWARDED, MULTIPLIER_STEPS, FREE_SPIN_MULTIPLIER_STEPS } from "./constants";
import { getRtpBias, recordBet, recordPayout } from "./RtpController";
import { stopsToGrid } from "./ReelStrips";
import { recordSpin } from "../websocket";

function countScatters(grid: Symbol[][]): number {
  return grid.flat().filter(s => s === "SCATTER").length;
}

export async function spin(req: SpinRequest): Promise<SpinResult> {
  const { userId, betAmount, isFreeSpinMode = false, freeSpinMultiplier = 1 } = req;
  const steps = isFreeSpinMode ? FREE_SPIN_MULTIPLIER_STEPS : MULTIPLIER_STEPS;
  await recordBet(betAmount, userId);
  const bias = await getRtpBias(userId);
  const grid = generateGrid();
  const initialMultiplier = isFreeSpinMode ? freeSpinMultiplier : steps[0];
  const initialWins = calculateWins(grid, betAmount, initialMultiplier, bias);
  const cascades = runCascades(grid, betAmount, isFreeSpinMode, bias);
  const cascadeWin = cascades.reduce((sum, c) => sum + c.wins.reduce((s, w) => s + w.payout, 0), 0);
  const initialWin = initialWins.reduce((sum, w) => sum + w.payout, 0);
  const totalWin = initialWin + cascadeWin;
  await recordPayout(totalWin, userId);
  await recordSpin(userId, "player", betAmount, totalWin);
  const multiplier = cascades.length > 0
    ? cascades[cascades.length - 1].multiplier
    : initialMultiplier;
  const scatterCount = countScatters(grid);
  const freeSpinsAwarded = scatterCount >= SCATTER_TRIGGER_COUNT ? FREE_SPINS_AWARDED : 0;
  return {
    grid,
    wins: initialWins,
    totalWin,
    cascades,
    multiplier,
    freeSpinsAwarded,
    isFreeSpinMode,
  };
}

export async function calculateWinFromStops(
  stops: number[],
  betAmount: number,
  playerId: string,
  isFreeSpinMode: boolean = false,
  freeSpinMultiplier: number = 1
): Promise<SpinResult> {
  const steps = isFreeSpinMode ? FREE_SPIN_MULTIPLIER_STEPS : MULTIPLIER_STEPS;
  const bias = await getRtpBias(playerId);
  const grid = stopsToGrid(stops);
  const initialMultiplier = isFreeSpinMode ? freeSpinMultiplier : steps[0];
  const initialWins = calculateWins(grid, betAmount, initialMultiplier, bias);
  const cascades = runCascades(grid, betAmount, isFreeSpinMode, bias);
  const cascadeWin = cascades.reduce((sum, c) => sum + c.wins.reduce((s, w) => s + w.payout, 0), 0);
  const initialWin = initialWins.reduce((sum, w) => sum + w.payout, 0);
  const totalWin = initialWin + cascadeWin;
  await recordBet(betAmount, playerId);
  await recordPayout(totalWin, playerId);
  await recordSpin(playerId, "player", betAmount, totalWin);
  const multiplier = cascades.length > 0
    ? cascades[cascades.length - 1].multiplier
    : initialMultiplier;
  const scatterCount = countScatters(grid);
  const freeSpinsAwarded = scatterCount >= SCATTER_TRIGGER_COUNT ? FREE_SPINS_AWARDED : 0;
  return {
    grid,
    wins: initialWins,
    totalWin,
    cascades,
    multiplier,
    freeSpinsAwarded,
    isFreeSpinMode,
  };
}
