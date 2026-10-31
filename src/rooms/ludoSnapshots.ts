import type { MatchMode } from "../roomMatchmakingRegistry";
import type { MultiplayerAnimationConfigMessage } from "../serverTimingConfig";
import { getDashboardPlayers } from "./ludoPlayers";
import { getBoardIndex, toGlobalPosition } from "./ludoRules";
import type { PlayerProfileMessage, PlayerState } from "./ludoTypes";

export interface LudoSnapshotContext {
  roomCode: string;
  roomId: string;
  matchMode: MatchMode;
  players: PlayerState[];
  playerProfiles: Map<string, PlayerProfileMessage>;
  expectedPlayerCount: number;
  pawnCount: number;
  commonTrackCount: number;
  commonPathCount: number;
  totalMoveCount: number;
  safePointIndexes: Set<number>;
  animationConfig: MultiplayerAnimationConfigMessage;
  hasGameStarted: boolean;
  isGameOver: boolean;
  currentPlayerId: string;
  currentDiceNumber: number;
  activePawnIds: string[];
  winnerPlayerIds: string[];
  turnSequence: number;
}

export function buildGameStartedMessage(context: LudoSnapshotContext, localPlayerId: string, clientKey: string) {
  return {
    roomCode: context.roomCode,
    clientKey,
    localPlayerId,
    playerIds: getPlayerIds(context.players),
    playerStartIndexes: getPlayerStartIndexes(context.players),
    playerPositions: getPlayerPositions(context.players),
    playerProfiles: getPlayerProfiles(context),
    botStatuses: getBotStatuses(context.players),
    animationConfig: { ...context.animationConfig }
  };
}

export function buildRoomStateSnapshot(context: LudoSnapshotContext, syncReason: string, localPlayerId: string, clientKey: string) {
  return {
    roomCode: context.roomCode,
    syncReason,
    clientKey,
    localPlayerId,
    playerIds: getPlayerIds(context.players),
    playerStartIndexes: getPlayerStartIndexes(context.players),
    playerPositions: getPlayerPositions(context.players),
    playerProfiles: getPlayerProfiles(context),
    botStatuses: getBotStatuses(context.players),
    animationConfig: { ...context.animationConfig },
    players: getDashboardPlayers(context.players, context.playerProfiles),
    hasGameStarted: context.hasGameStarted,
    isGameOver: context.isGameOver,
    currentPlayerId: context.currentPlayerId,
    turnSequence: context.turnSequence,
    diceNumbers: getDiceNumbers(context.currentDiceNumber),
    activePawnIds: context.activePawnIds,
    winnerPlayerIds: context.winnerPlayerIds,
    pawns: context.players.flatMap((player) => player.pawns.map((pawn) => ({
      playerId: player.playerId,
      pawnId: pawn.pawnId,
      position: toGlobalPosition(player, pawn, context.commonPathCount, context.commonTrackCount),
      isHome: pawn.isHome
    })))
  };
}

export function buildDashboardSnapshot(context: LudoSnapshotContext) {
  return {
    roomCode: context.roomCode,
    roomId: context.roomId,
    matchMode: context.matchMode,
    playerCount: context.players.length,
    connectedPlayerCount: context.players.filter((player) => player.connected).length,
    expectedPlayerCount: context.expectedPlayerCount,
    pawnCount: context.pawnCount,
    commonTrackCount: context.commonTrackCount,
    commonPathCount: context.commonPathCount,
    totalMoveCount: context.totalMoveCount,
    safePointIndexes: [...context.safePointIndexes],
    animationConfig: { ...context.animationConfig },
    hasGameStarted: context.hasGameStarted,
    isGameOver: context.isGameOver,
    currentPlayerId: context.currentPlayerId,
    diceNumbers: getDiceNumbers(context.currentDiceNumber),
    activePawnIds: context.activePawnIds,
    winnerPlayerIds: context.winnerPlayerIds,
    botStatuses: getBotStatuses(context.players),
    playerProfiles: getPlayerProfiles(context),
    players: getDashboardPlayers(context.players, context.playerProfiles),
    pawns: context.players.flatMap((player) => player.pawns.map((pawn) => ({
      playerId: player.playerId,
      pawnId: pawn.pawnId,
      position: pawn.position,
      isHome: pawn.isHome,
      boardIndex: getBoardIndex(player, pawn, context.commonPathCount, context.commonTrackCount)
    })))
  };
}

function getPlayerIds(players: PlayerState[]): string[] {
  return players.map((player) => player.playerId);
}

function getPlayerStartIndexes(players: PlayerState[]): number[] {
  return players.map((player) => player.startIndex);
}

function getPlayerPositions(players: PlayerState[]): string[] {
  return players.map((player) => player.playerPosition);
}

function getPlayerProfiles(context: LudoSnapshotContext): PlayerProfileMessage[] {
  return context.players
    .map((player) => context.playerProfiles.get(player.playerId))
    .filter((profile): profile is PlayerProfileMessage => profile != null);
}

function getBotStatuses(players: PlayerState[]): Array<{ playerId: string; isBot: boolean }> {
  return players.map((player) => ({
    playerId: player.playerId,
    isBot: player.isBot
  }));
}

function getDiceNumbers(currentDiceNumber: number): number[] {
  return currentDiceNumber > 0 ? [currentDiceNumber] : [];
}
