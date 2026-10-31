import type { PawnState, PlayerState } from "./ludoTypes";

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function getNextConsecutiveSixCount(currentCount: number, diceNumber: number): number {
  return diceNumber === 6 ? currentCount + 1 : 0;
}

export function createPawns(playerId: string, pawnCount: number): PawnState[] {
  const pawns: PawnState[] = [];
  for (let index = 0; index < pawnCount; index++) {
    pawns.push({
      pawnId: `${playerId}-pawn-${index.toString().padStart(2, "0")}`,
      position: -1,
      isHome: false
    });
  }

  return pawns;
}

export function getLegalPawnIds(player: PlayerState, diceNumber: number, totalMoveCount: number): string[] {
  return player.pawns
    .filter((pawn) => {
      if (pawn.isHome) {
        return false;
      }

      if (pawn.position < 0) {
        return diceNumber === 6;
      }

      return pawn.position + diceNumber <= totalMoveCount;
    })
    .map((pawn) => pawn.pawnId);
}

export function getTargetPosition(pawn: PawnState, diceNumber: number): number {
  return pawn.position < 0 ? 0 : pawn.position + diceNumber;
}

export function getBoardIndexForPosition(
  player: PlayerState,
  position: number,
  isHome: boolean,
  commonPathCount: number,
  commonTrackCount: number
): number | null {
  if (position < 0 || isHome || position >= commonPathCount) {
    return null;
  }

  return (player.startIndex + position) % commonTrackCount;
}

export function getBoardIndex(
  player: PlayerState,
  pawn: PawnState,
  commonPathCount: number,
  commonTrackCount: number
): number | null {
  return getBoardIndexForPosition(player, pawn.position, pawn.isHome, commonPathCount, commonTrackCount);
}

export function toGlobalPosition(
  player: PlayerState,
  pawn: PawnState,
  commonPathCount: number,
  commonTrackCount: number
): number {
  if (pawn.position < 0) {
    return -1;
  }

  if (pawn.position < commonPathCount) {
    return (player.startIndex + pawn.position) % commonTrackCount;
  }

  return commonTrackCount + (pawn.position - commonPathCount);
}

export function findCapturedPawnAtBoardIndex(
  players: PlayerState[],
  currentPlayer: PlayerState,
  movedBoardIndex: number | null,
  safePointIndexes: Set<number>,
  commonPathCount: number,
  commonTrackCount: number
): PawnState | null {
  if (movedBoardIndex == null || safePointIndexes.has(movedBoardIndex)) {
    return null;
  }

  for (const player of players) {
    if (player.playerId === currentPlayer.playerId) {
      continue;
    }

    const capturedPawn = player.pawns.find((pawn) => {
      return !pawn.isHome && getBoardIndex(player, pawn, commonPathCount, commonTrackCount) === movedBoardIndex;
    });
    if (capturedPawn != null) {
      return capturedPawn;
    }
  }

  return null;
}

export function findCapturedPawn(
  players: PlayerState[],
  currentPlayer: PlayerState,
  movedPawn: PawnState,
  safePointIndexes: Set<number>,
  commonPathCount: number,
  commonTrackCount: number
): PawnState | null {
  const movedBoardIndex = getBoardIndex(currentPlayer, movedPawn, commonPathCount, commonTrackCount);
  return findCapturedPawnAtBoardIndex(
    players,
    currentPlayer,
    movedBoardIndex,
    safePointIndexes,
    commonPathCount,
    commonTrackCount
  );
}

export function chooseBotPawn(
  players: PlayerState[],
  player: PlayerState,
  activePawnIds: string[],
  diceNumber: number,
  totalMoveCount: number,
  commonPathCount: number,
  commonTrackCount: number,
  safePointIndexes: Set<number>
): PawnState | null {
  const legalPawns = activePawnIds
    .map((pawnId) => player.pawns.find((pawn) => pawn.pawnId === pawnId) || null)
    .filter((pawn): pawn is PawnState => pawn != null);

  if (legalPawns.length === 0) {
    return null;
  }

  const capturePawn = legalPawns.find((pawn) => {
    const targetPosition = getTargetPosition(pawn, diceNumber);
    const boardIndex = getBoardIndexForPosition(
      player,
      targetPosition,
      targetPosition >= totalMoveCount,
      commonPathCount,
      commonTrackCount
    );
    return findCapturedPawnAtBoardIndex(
      players,
      player,
      boardIndex,
      safePointIndexes,
      commonPathCount,
      commonTrackCount
    ) != null;
  });
  if (capturePawn != null) {
    return capturePawn;
  }

  const homePawn = legalPawns.find((pawn) => getTargetPosition(pawn, diceNumber) >= totalMoveCount);
  if (homePawn != null) {
    return homePawn;
  }

  return [...legalPawns].sort((left, right) => {
    const progressDelta = getTargetPosition(right, diceNumber) - getTargetPosition(left, diceNumber);
    return progressDelta !== 0 ? progressDelta : left.pawnId.localeCompare(right.pawnId);
  })[0] || legalPawns[0];
}

export function areAllPawnsHome(player: PlayerState): boolean {
  return player.pawns.every((candidate) => candidate.isHome);
}
