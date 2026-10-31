import {
  findCapturedPawnAtBoardIndex,
  getBoardIndex,
  getBoardIndexForPosition,
  getLegalPawnIds,
  getTargetPosition
} from "./ludoRules";
import type { PawnState, PlayerState } from "./ludoTypes";

export const LUDO_BOT_AI_SCORES = {
  openScore: 150,
  backwardScore: -5,
  forwardScore: 20,
  starScore: 50,
  homeScore: 20,
  killScore: 200,
  safeScore: 100,
  winScore: 200,
  blockScore: 100,
  safeRiskScore: -20
} as const;

export interface LudoBotAiContext {
  players: PlayerState[];
  player: PlayerState;
  activePawnIds: string[];
  diceNumber: number;
  totalMoveCount: number;
  commonPathCount: number;
  commonTrackCount: number;
  safePointIndexes: Set<number>;
}

export interface LudoBotPawnScore {
  pawn: PawnState;
  score: number;
  scoreText: string;
}

const NEARBY_SCAN_DISTANCE = 6;
const INVALID_SCORE = Number.MIN_SAFE_INTEGER;

export function chooseLudoBotPawn(context: LudoBotAiContext): PawnState | null {
  const scoredPawns = scoreLudoBotPawns(context);
  if (scoredPawns.length === 0) {
    return null;
  }

  let bestScore = scoredPawns[0];
  for (const pawnScore of scoredPawns.slice(1)) {
    if (pawnScore.score > bestScore.score) {
      bestScore = pawnScore;
    }
  }

  return bestScore.score > INVALID_SCORE ? bestScore.pawn : getFallbackPawn(context);
}

export function scoreLudoBotPawns(context: LudoBotAiContext): LudoBotPawnScore[] {
  return getActivePawns(context).map((pawn) => scoreLudoBotPawn(context, pawn));
}

export function scoreLudoBotPawn(context: LudoBotAiContext, pawn: PawnState): LudoBotPawnScore {
  const scoreLines = [`Dice: ${context.diceNumber} -> Position ${pawn.position}`];

  if (pawn.isHome) {
    return {
      pawn,
      score: INVALID_SCORE,
      scoreText: `${scoreLines.join("\n")}\nHome pawn: invalid`
    };
  }

  if (pawn.position < 0) {
    scoreLines.push(`Open : -> ${LUDO_BOT_AI_SCORES.openScore} Score: ${LUDO_BOT_AI_SCORES.openScore}`);
    return {
      pawn,
      score: LUDO_BOT_AI_SCORES.openScore,
      scoreText: scoreLines.join("\n")
    };
  }

  const targetPosition = getTargetPosition(pawn, context.diceNumber);
  if (targetPosition < 0 || targetPosition > context.totalMoveCount) {
    return {
      pawn,
      score: INVALID_SCORE,
      scoreText: `${scoreLines.join("\n")}\nTarget: ${targetPosition} invalid`
    };
  }

  let score = 0;
  const targetIsHomePath = targetPosition >= context.commonPathCount;
  const targetIsFinalHome = targetPosition >= context.totalMoveCount;
  const targetBoardIndex = getBoardIndexForPosition(
    context.player,
    targetPosition,
    targetIsFinalHome,
    context.commonPathCount,
    context.commonTrackCount
  );
  const currentBoardIndex = getBoardIndex(context.player, pawn, context.commonPathCount, context.commonTrackCount);
  scoreLines.push(`Target : -> ${targetPosition} targetBoardIndex : ${targetBoardIndex ?? "home"}`);

  const nearbyScore = getNearbyOpponentScore(context, targetPosition);
  if (nearbyScore.forwardScore > 0) {
    score += nearbyScore.forwardScore;
    scoreLines.push(`Forward : -> ${nearbyScore.forwardCount} Score: ${nearbyScore.forwardScore}`);
  }

  if (nearbyScore.backwardScore !== 0) {
    score += nearbyScore.backwardScore;
    scoreLines.push(`Backward : -> ${nearbyScore.backwardCount} Score: ${nearbyScore.backwardScore}`);
  }

  if (targetBoardIndex != null && context.safePointIndexes.has(targetBoardIndex)) {
    score += LUDO_BOT_AI_SCORES.starScore;
    scoreLines.push(`Star : -> ${LUDO_BOT_AI_SCORES.starScore} Score: ${score}`);
  }

  if (targetIsHomePath) {
    score += LUDO_BOT_AI_SCORES.homeScore;
    scoreLines.push(`Home : -> ${LUDO_BOT_AI_SCORES.homeScore} Score: ${score}`);
  }

  if (
    findCapturedPawnAtBoardIndex(
      context.players,
      context.player,
      targetBoardIndex,
      context.safePointIndexes,
      context.commonPathCount,
      context.commonTrackCount
    ) != null
  ) {
    score += LUDO_BOT_AI_SCORES.killScore;
    scoreLines.push(`Kill : -> ${LUDO_BOT_AI_SCORES.killScore} Score: ${score}`);
  }

  if (isSafeMove(context, currentBoardIndex, targetBoardIndex, targetIsHomePath)) {
    score += LUDO_BOT_AI_SCORES.safeScore;
    scoreLines.push(`Safe : -> ${LUDO_BOT_AI_SCORES.safeScore} Score: ${score}`);
  }

  if (getOwnPawnCountAtTarget(context, pawn, targetPosition, targetBoardIndex, targetIsHomePath) === 1) {
    score += LUDO_BOT_AI_SCORES.blockScore;
    scoreLines.push(`Block : -> ${LUDO_BOT_AI_SCORES.blockScore} Score: ${score}`);
  }

  if (isCurrentPawnSafe(context, pawn, currentBoardIndex)) {
    score += LUDO_BOT_AI_SCORES.safeRiskScore;
    scoreLines.push(`Safe Risk : -> ${LUDO_BOT_AI_SCORES.safeRiskScore} Score: ${score}`);
  }

  if (targetIsFinalHome) {
    score += LUDO_BOT_AI_SCORES.winScore;
    scoreLines.push(`Win : -> ${LUDO_BOT_AI_SCORES.winScore} Score: ${score}`);
  }

  score += targetPosition + 1;
  scoreLines.push(`Progress : -> ${targetPosition + 1} Score: ${score}`);

  return {
    pawn,
    score,
    scoreText: scoreLines.join("\n")
  };
}

function getActivePawns(context: LudoBotAiContext): PawnState[] {
  const legalPawnIds = new Set(getLegalPawnIds(context.player, context.diceNumber, context.totalMoveCount));
  return context.activePawnIds
    .map((pawnId) => context.player.pawns.find((pawn) => pawn.pawnId === pawnId) || null)
    .filter((pawn): pawn is PawnState => pawn != null && !pawn.isHome && legalPawnIds.has(pawn.pawnId));
}

function getFallbackPawn(context: LudoBotAiContext): PawnState | null {
  return getActivePawns(context)
    .sort((left, right) => {
      const positionDelta = left.position - right.position;
      return positionDelta !== 0 ? positionDelta : left.pawnId.localeCompare(right.pawnId);
    })[0] || null;
}

function getNearbyOpponentScore(context: LudoBotAiContext, targetPosition: number) {
  let forwardCount = 0;
  let backwardCount = 0;

  if (targetPosition < 0 || targetPosition >= context.commonPathCount) {
    return {
      forwardCount,
      backwardCount,
      forwardScore: 0,
      backwardScore: 0
    };
  }

  for (const opponent of context.players) {
    if (opponent.playerId === context.player.playerId) {
      continue;
    }

    for (const opponentPawn of opponent.pawns) {
      const opponentBoardIndex = getBoardIndex(opponent, opponentPawn, context.commonPathCount, context.commonTrackCount);
      if (opponentBoardIndex == null) {
        continue;
      }

      const opponentPathPosition = boardIndexToPlayerPathPosition(
        context.player,
        opponentBoardIndex,
        context.commonTrackCount
      );
      const aheadDistance = getForwardDistance(targetPosition, opponentPathPosition, context.commonTrackCount);
      if (aheadDistance >= 1 && aheadDistance <= NEARBY_SCAN_DISTANCE) {
        forwardCount++;
        continue;
      }

      const behindDistance = getForwardDistance(opponentPathPosition, targetPosition, context.commonTrackCount);
      if (behindDistance >= 1 && behindDistance <= NEARBY_SCAN_DISTANCE) {
        backwardCount++;
      }
    }
  }

  return {
    forwardCount,
    backwardCount,
    forwardScore: forwardCount * LUDO_BOT_AI_SCORES.forwardScore,
    backwardScore: backwardCount * LUDO_BOT_AI_SCORES.backwardScore
  };
}

function boardIndexToPlayerPathPosition(player: PlayerState, boardIndex: number, commonTrackCount: number): number {
  return (boardIndex - player.startIndex + commonTrackCount) % commonTrackCount;
}

function getForwardDistance(fromPosition: number, toPosition: number, commonTrackCount: number): number {
  return (toPosition - fromPosition + commonTrackCount) % commonTrackCount;
}

function isSafeMove(
  context: LudoBotAiContext,
  currentBoardIndex: number | null,
  targetBoardIndex: number | null,
  targetIsHome: boolean
): boolean {
  if (targetIsHome) {
    return currentBoardIndex != null && context.safePointIndexes.has(currentBoardIndex);
  }

  return currentBoardIndex != null &&
    targetBoardIndex != null &&
    context.safePointIndexes.has(currentBoardIndex) &&
    context.safePointIndexes.has(targetBoardIndex) &&
    currentBoardIndex !== targetBoardIndex;
}

function isCurrentPawnSafe(context: LudoBotAiContext, pawn: PawnState, currentBoardIndex: number | null): boolean {
  return pawn.position === 0 || (currentBoardIndex != null && context.safePointIndexes.has(currentBoardIndex));
}

function getOwnPawnCountAtTarget(
  context: LudoBotAiContext,
  movingPawn: PawnState,
  targetPosition: number,
  targetBoardIndex: number | null,
  targetIsHome: boolean
): number {
  return context.player.pawns.filter((pawn) => {
    if (pawn.pawnId === movingPawn.pawnId || pawn.isHome) {
      return false;
    }

    if (targetIsHome) {
      return pawn.position === targetPosition;
    }

    return getBoardIndex(context.player, pawn, context.commonPathCount, context.commonTrackCount) === targetBoardIndex;
  }).length;
}
