import {
  findCapturedPawnAtBoardIndex,
  getBoardIndex,
  getBoardIndexForPosition,
  getLegalPawnIds,
  getTargetPosition,
  rollDice
} from "./ludoRules";
import { getDiceAiConfig } from "../serverDiceAiConfig";
import type { ServerDiceAiConfig } from "../serverDiceAiConfig";
import type { PlayerState } from "./ludoTypes";

const DICE_VALUES = [1, 2, 3, 4, 5, 6] as const;
const HISTORY_LIMIT = 6;

export type DiceValue = typeof DICE_VALUES[number];

export interface DiceAiMemory {
  history: number[];
  noMoveStreak: number;
  rollsSinceSix: number;
  forceSixTargetTurns: number;
}

export interface DiceAiRollContext {
  players: PlayerState[];
  player: PlayerState;
  totalMoveCount: number;
  commonPathCount: number;
  commonTrackCount: number;
  safePointIndexes: Set<number>;
  consecutiveSixCount: number;
}

export interface DiceWeight {
  dice: DiceValue;
  weight: number;
}

type DiceWeights = Record<DiceValue, number>;

export function createDiceAiMemory(): DiceAiMemory {
  return {
    history: [],
    noMoveStreak: 0,
    rollsSinceSix: 0,
    forceSixTargetTurns: 0
  };
}

export class ServerDiceAi {
  private readonly playerMemory = new Map<string, DiceAiMemory>();

  roll(context: DiceAiRollContext, random: () => number = Math.random): number {
    const memory = this.getMemory(context.player.playerId);
    const config = getDiceAiConfig();
    ensureForceSixTarget(memory, config, random);
    const diceNumber = shouldForceSix(memory, context)
      ? 6
      : pickWeightedDice(buildDiceWeights(context, memory, config), random);
    recordDiceResult(memory, context, diceNumber);
    ensureForceSixTarget(memory, config, random);
    return diceNumber;
  }

  getMemory(playerId: string): DiceAiMemory {
    let memory = this.playerMemory.get(playerId);
    if (memory == null) {
      memory = createDiceAiMemory();
      this.playerMemory.set(playerId, memory);
    }

    return memory;
  }
}

export function buildDiceWeights(
  context: DiceAiRollContext,
  memory: DiceAiMemory,
  config: ServerDiceAiConfig = getDiceAiConfig()
): DiceWeight[] {
  const weights = resetBaseWeights(config);
  applyComboRules(weights, memory, config);
  applyKillRules(weights, context, config);
  applySafePointRules(weights, context, config);
  applyTacticalRules(weights, context, config);
  applyAntiCheatFeel(weights, context, memory, config);
  return normalizeWeights(weights, config);
}

export function pickWeightedDice(weights: DiceWeight[], random: () => number = Math.random): number {
  const totalWeight = weights.reduce((total, entry) => total + entry.weight, 0);
  if (totalWeight <= 0) {
    return rollDice();
  }

  let cursor = random() * totalWeight;
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.dice;
    }
  }

  return weights[weights.length - 1]?.dice || rollDice();
}

export function recordDiceResult(memory: DiceAiMemory, context: DiceAiRollContext, diceNumber: number) {
  memory.history.push(diceNumber);
  while (memory.history.length > HISTORY_LIMIT) {
    memory.history.shift();
  }

  const legalPawnIds = getLegalPawnIds(context.player, diceNumber, context.totalMoveCount);
  memory.noMoveStreak = legalPawnIds.length === 0 ? memory.noMoveStreak + 1 : 0;
  memory.rollsSinceSix = diceNumber === 6 ? 0 : memory.rollsSinceSix + 1;
}

function resetBaseWeights(config: ServerDiceAiConfig): DiceWeights {
  return {
    1: config.dice1Weight,
    2: config.dice2Weight,
    3: config.dice3Weight,
    4: config.dice4Weight,
    5: config.dice5Weight,
    6: config.dice6Weight
  };
}

function applyComboRules(weights: DiceWeights, memory: DiceAiMemory, config: ServerDiceAiConfig) {
  const lastTwo = memory.history.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((dice) => dice === 6)) {
    increaseWeight(weights, 5, config.combo665Percent);
    increaseWeight(weights, 6, config.combo666Percent);
  }
}

function applyKillRules(weights: DiceWeights, context: DiceAiRollContext, config: ServerDiceAiConfig) {
  for (const dice of DICE_VALUES) {
    if (canKillWithDice(context, dice)) {
      increaseWeight(weights, dice, config.killDiceNumberPercent);
    }
  }
}

function applySafePointRules(weights: DiceWeights, context: DiceAiRollContext, config: ServerDiceAiConfig) {
  for (const dice of DICE_VALUES) {
    if (canReachSafePointWithDice(context, dice)) {
      increaseWeight(weights, dice, config.safePointDiceNumberPercent);
    }
  }
}

function applyTacticalRules(weights: DiceWeights, context: DiceAiRollContext, config: ServerDiceAiConfig) {
  for (const dice of DICE_VALUES) {
    const legalPawnIds = getLegalPawnIds(context.player, dice, context.totalMoveCount);
    if (legalPawnIds.length === 0) {
      continue;
    }

    let opensPawn = false;
    let finishesPawn = false;
    let bestProgressPercent = 0;
    for (const pawnId of legalPawnIds) {
      const pawn = context.player.pawns.find((candidate) => candidate.pawnId === pawnId);
      if (pawn == null) {
        continue;
      }

      if (pawn.position < 0 && dice === 6) {
        opensPawn = true;
      }

      const targetPosition = getTargetPosition(pawn, dice);
      if (targetPosition >= context.totalMoveCount) {
        finishesPawn = true;
      } else if (pawn.position >= 0) {
        bestProgressPercent = Math.max(bestProgressPercent, targetPosition / Math.max(1, context.totalMoveCount));
      }
    }

    if (opensPawn) {
      increaseWeight(weights, dice, config.openPawnDiceNumberPercent);
    }

    if (finishesPawn) {
      increaseWeight(weights, dice, config.finishPawnDiceNumberPercent);
    } else if (bestProgressPercent > 0) {
      increaseWeight(weights, dice, config.progressDiceNumberPercent * bestProgressPercent);
    }
  }
}

function applyAntiCheatFeel(
  weights: DiceWeights,
  context: DiceAiRollContext,
  memory: DiceAiMemory,
  config: ServerDiceAiConfig
) {
  const lastDice = memory.history[memory.history.length - 1];
  if (isDiceValue(lastDice)) {
    decreaseWeight(weights, lastDice, config.repeatPenaltyPercent);
  }

  for (const dice of DICE_VALUES) {
    const recentCount = memory.history.filter((value) => value === dice).length;
    if (recentCount >= 2) {
      decreaseWeight(weights, dice, config.repeatPenaltyPercent / 2);
    }

    const legalPawnIds = getLegalPawnIds(context.player, dice, context.totalMoveCount);
    if (legalPawnIds.length === 0) {
      decreaseWeight(weights, dice, memory.noMoveStreak > 0 ? 18 : 10);
    } else {
      increaseWeight(weights, dice, Math.min(18, memory.noMoveStreak * 6));
    }
  }

  if (context.consecutiveSixCount >= 2) {
    decreaseWeight(weights, 6, config.thirdSixPenaltyPercent);
  } else if (context.consecutiveSixCount === 1) {
    decreaseWeight(weights, 6, config.thirdSixPenaltyPercent / 4);
  }
}

function normalizeWeights(weights: DiceWeights, config: ServerDiceAiConfig): DiceWeight[] {
  return DICE_VALUES.map((dice) => ({
    dice,
    weight: Math.max(config.minDiceWeight, Math.min(config.maxDiceWeight, weights[dice]))
  }));
}

export function ensureForceSixTarget(
  memory: DiceAiMemory,
  config: ServerDiceAiConfig,
  random: () => number = Math.random
) {
  const minTurns = Math.floor(config.forceSixAfterNoSixMinTurns);
  const maxTurns = Math.floor(Math.max(minTurns, config.forceSixAfterNoSixMaxTurns));
  if (memory.forceSixTargetTurns <= 0 || memory.forceSixTargetTurns < minTurns || memory.forceSixTargetTurns > maxTurns) {
    memory.forceSixTargetTurns = randomIntInclusive(minTurns, maxTurns, random);
  }
}

export function shouldForceSix(memory: DiceAiMemory, context: DiceAiRollContext): boolean {
  return context.consecutiveSixCount < 2 &&
    memory.forceSixTargetTurns > 0 &&
    memory.rollsSinceSix >= memory.forceSixTargetTurns;
}

function canKillWithDice(context: DiceAiRollContext, dice: DiceValue): boolean {
  return getLegalPawnIds(context.player, dice, context.totalMoveCount).some((pawnId) => {
    const pawn = context.player.pawns.find((candidate) => candidate.pawnId === pawnId);
    if (pawn == null) {
      return false;
    }

    const targetPosition = getTargetPosition(pawn, dice);
    if (targetPosition >= context.commonPathCount) {
      return false;
    }

    const targetBoardIndex = getBoardIndexForPosition(
      context.player,
      targetPosition,
      false,
      context.commonPathCount,
      context.commonTrackCount
    );
    return findCapturedPawnAtBoardIndex(
      context.players,
      context.player,
      targetBoardIndex,
      context.safePointIndexes,
      context.commonPathCount,
      context.commonTrackCount
    ) != null;
  });
}

function canReachSafePointWithDice(context: DiceAiRollContext, dice: DiceValue): boolean {
  return getLegalPawnIds(context.player, dice, context.totalMoveCount).some((pawnId) => {
    const pawn = context.player.pawns.find((candidate) => candidate.pawnId === pawnId);
    if (pawn == null) {
      return false;
    }

    const targetPosition = getTargetPosition(pawn, dice);
    if (targetPosition >= context.commonPathCount) {
      return false;
    }

    const currentBoardIndex = getBoardIndex(context.player, pawn, context.commonPathCount, context.commonTrackCount);
    const targetBoardIndex = getBoardIndexForPosition(
      context.player,
      targetPosition,
      false,
      context.commonPathCount,
      context.commonTrackCount
    );
    return targetBoardIndex != null &&
      targetBoardIndex !== currentBoardIndex &&
      context.safePointIndexes.has(targetBoardIndex);
  });
}

function increaseWeight(weights: DiceWeights, dice: DiceValue, percent: number) {
  weights[dice] *= 1 + Math.max(0, percent) / 100;
}

function decreaseWeight(weights: DiceWeights, dice: DiceValue, percent: number) {
  weights[dice] *= Math.max(0, 1 - Math.max(0, percent) / 100);
}

function isDiceValue(value: number | undefined): value is DiceValue {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

function randomIntInclusive(min: number, max: number, random: () => number): number {
  return min + Math.floor(random() * (max - min + 1));
}
