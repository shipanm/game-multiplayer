import assert from "node:assert/strict";
import { findCapturedPawn, findCapturedPawnAtBoardIndex, toGlobalPosition } from "./ludoRules";
import type { PawnState, PlayerPositionName, PlayerState } from "./ludoTypes";

const COMMON_TRACK_COUNT = 52;
const COMMON_PATH_COUNT = 51;
const TOTAL_MOVE_COUNT = 56;

function createPlayer(playerId: string, startIndex: number, playerPosition: PlayerPositionName, pawns: PawnState[]): PlayerState {
  return {
    clientKey: `${playerId}-client`,
    sessionId: `${playerId}-session`,
    playerId,
    slotIndex: 0,
    startIndex,
    playerPosition,
    pawns,
    connected: true,
    isBot: false,
    turnTimeoutHandle: null,
    botActionHandle: null
  };
}

export function runLudoRulesCaptureSmoke(): void {
  const moverPawn: PawnState = { pawnId: "server-red-pawn-00", position: 5, isHome: false };
  const capturedPawn: PawnState = { pawnId: "server-yellow-pawn-00", position: 31, isHome: false };
  const mover = createPlayer("server-red", 0, "BOTTOM_LEFT", [moverPawn]);
  const opponent = createPlayer("server-yellow", 26, "TOP_RIGHT", [capturedPawn]);
  const players = [mover, opponent];

  assert.equal(
    findCapturedPawn(players, mover, moverPawn, new Set<number>(), COMMON_PATH_COUNT, COMMON_TRACK_COUNT),
    capturedPawn,
    "capture must use server board indexes even when client visual colors/seats differ"
  );

  assert.equal(
    findCapturedPawn(players, mover, moverPawn, new Set<number>([5]), COMMON_PATH_COUNT, COMMON_TRACK_COUNT),
    null,
    "safe board indexes must not capture"
  );

  capturedPawn.position = -1;
  assert.equal(
    findCapturedPawnAtBoardIndex(players, mover, 5, new Set<number>(), COMMON_PATH_COUNT, COMMON_TRACK_COUNT),
    null,
    "pawns in base/death must not be captured"
  );

  capturedPawn.position = 31;
  capturedPawn.isHome = true;
  assert.equal(
    findCapturedPawnAtBoardIndex(players, mover, 5, new Set<number>(), COMMON_PATH_COUNT, COMMON_TRACK_COUNT),
    null,
    "home pawns must not be captured"
  );

  assert.equal(
    toGlobalPosition(mover, { pawnId: "common-end", position: COMMON_PATH_COUNT - 1, isHome: false }, COMMON_PATH_COUNT, COMMON_TRACK_COUNT),
    COMMON_PATH_COUNT - 1,
    "last common path position must still map to a physical board cell"
  );

  assert.equal(
    toGlobalPosition(mover, { pawnId: "home-entry", position: COMMON_PATH_COUNT, isHome: false }, COMMON_PATH_COUNT, COMMON_TRACK_COUNT),
    COMMON_TRACK_COUNT,
    "first home path position must map after the physical board ring"
  );

  assert.equal(
    toGlobalPosition(mover, { pawnId: "winner", position: TOTAL_MOVE_COUNT, isHome: true }, COMMON_PATH_COUNT, COMMON_TRACK_COUNT),
    COMMON_TRACK_COUNT + (TOTAL_MOVE_COUNT - COMMON_PATH_COUNT),
    "final win position must map to Unity's final move point"
  );

  assert.equal(
    findCapturedPawn(
      players,
      mover,
      { pawnId: "home-path", position: COMMON_PATH_COUNT, isHome: false },
      new Set<number>(),
      COMMON_PATH_COUNT,
      COMMON_TRACK_COUNT
    ),
    null,
    "home path positions must not capture"
  );
}

if (require.main === module) {
  runLudoRulesCaptureSmoke();
  console.log("ludoRulesCaptureSmoke passed");
}
