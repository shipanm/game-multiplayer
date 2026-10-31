import type { JoinOptions, PlayerPositionName, PlayerProfileMessage, PlayerState } from "./ludoTypes";

export function resolvePlayerProfile(playerId: string, profile?: PlayerProfileMessage): PlayerProfileMessage {
  return {
    playerId,
    realPlayerId: toStringValue(profile?.realPlayerId),
    playerName: toStringValue(profile?.playerName),
    avatarId: toStringValue(profile?.avatarId),
    photoUrl: toStringValue(profile?.photoUrl),
    frameId: toStringValue(profile?.frameId),
    pawnId: toStringValue(profile?.pawnId),
    diceId: toStringValue(profile?.diceId),
    boardId: toStringValue(profile?.boardId)
  };
}

export function getPlayerProfiles(
  players: PlayerState[],
  playerProfiles: Map<string, PlayerProfileMessage>
): PlayerProfileMessage[] {
  return players
    .map((player) => playerProfiles.get(player.playerId))
    .filter((profile): profile is PlayerProfileMessage => profile != null);
}

export function getBotStatuses(players: PlayerState[]): Array<{ playerId: string; isBot: boolean }> {
  return players.map((player) => ({
    playerId: player.playerId,
    isBot: player.isBot
  }));
}

export function getDashboardPlayers(
  players: PlayerState[],
  playerProfiles: Map<string, PlayerProfileMessage>
) {
  return players.map((player) => ({
    playerId: player.playerId,
    clientKey: player.clientKey,
    sessionId: player.sessionId,
    slotIndex: player.slotIndex,
    startIndex: player.startIndex,
    playerPosition: player.playerPosition,
    connected: player.connected,
    isBot: player.isBot,
    profile: playerProfiles.get(player.playerId) || null,
    pawnCount: player.pawns.length,
    pawnsHome: player.pawns.filter((pawn) => pawn.isHome).length,
    pawnsInBase: player.pawns.filter((pawn) => pawn.position < 0 && !pawn.isHome).length
  }));
}

export function resolveClientKey(sessionId: string, options: JoinOptions): string {
  if (options.clientKey != null && options.clientKey.length > 0) {
    return options.clientKey;
  }

  return `session-${sessionId}`;
}

export function createServerPlayerId(roomCode: string, slotIndex: number): string {
  return `${getRoomNameSegment(roomCode)}-player-id-${slotIndex.toString().padStart(2, "0")}`;
}

export function getNextAvailableSlotIndex(players: PlayerState[], maxClients: number, roomCode: string): number {
  for (let index = 0; index < maxClients; index++) {
    const playerId = createServerPlayerId(roomCode, index);
    if (!players.some((player) => player.playerId === playerId)) {
      return index;
    }
  }

  return players.length;
}

export function resolvePlayerStartIndex(
  slotIndex: number,
  options: JoinOptions,
  commonTrackCount: number,
  expectedPlayerCount: number
): number {
  const playerStartIndexes = Array.isArray(options.playerStartIndexes) ? options.playerStartIndexes : [];
  if (slotIndex >= 0 && slotIndex < playerStartIndexes.length) {
    return Number(playerStartIndexes[slotIndex] || 0);
  }

  return (slotIndex * Math.floor(commonTrackCount / Math.max(1, expectedPlayerCount))) % commonTrackCount;
}

export function resolvePlayerPosition(slotIndex: number, expectedPlayerCount: number): PlayerPositionName {
  const seatOrder = getSeatOrder(expectedPlayerCount);
  return seatOrder[Math.max(0, slotIndex) % seatOrder.length];
}

function getSeatOrder(expectedPlayerCount: number): PlayerPositionName[] {
  if (expectedPlayerCount <= 2) {
    return ["BOTTOM_LEFT", "TOP_RIGHT"];
  }

  if (expectedPlayerCount === 3) {
    return ["BOTTOM_LEFT", "TOP_LEFT", "TOP_RIGHT"];
  }

  if (expectedPlayerCount === 5) {
    return ["BOTTOM_CENTER", "BOTTOM_LEFT", "TOP_LEFT", "TOP_RIGHT", "BOTTOM_RIGHT"];
  }

  if (expectedPlayerCount >= 6) {
    return ["BOTTOM_CENTER", "BOTTOM_LEFT", "TOP_LEFT", "TOP_CENTER", "TOP_RIGHT", "BOTTOM_RIGHT"];
  }

  return ["BOTTOM_LEFT", "TOP_LEFT", "TOP_RIGHT", "BOTTOM_RIGHT"];
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getRoomNameSegment(roomCode: string): string {
  return (roomCode || "room")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "room";
}
