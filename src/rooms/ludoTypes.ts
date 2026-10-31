export interface JoinOptions {
  clientKey?: string;
  playerId?: string;
  matchMode?: string;
  roomCode?: string;
  playerIds?: string[];
  playerStartIndexes?: number[];
  safePointIndexes?: number[];
  commonTrackCount?: number;
  commonPathCount?: number;
  pawnCount?: number;
  expectedPlayerCount?: number;
  totalMoveCount?: number;
  playerProfile?: PlayerProfileMessage;
}

export type PlayerPositionName = "BOTTOM_RIGHT" | "TOP_RIGHT" | "TOP_LEFT" | "BOTTOM_LEFT" | "BOTTOM_CENTER" | "TOP_CENTER";

export interface DiceRollRequestMessage {
  playerId: string;
}

export interface PawnMoveRequestMessage {
  playerId: string;
  pawnId: string;
}

export interface SyncStateRequestMessage {
  reason?: string;
}

export interface ChatDataMessage {
  playerId?: string;
  messageType?: string;
  data?: string;
}

export interface PlayerProfileMessage {
  playerId?: string;
  realPlayerId?: string;
  playerName?: string;
  avatarId?: string;
  photoUrl?: string;
  frameId?: string;
  pawnId?: string;
  diceId?: string;
  boardId?: string;
}

export interface PawnState {
  pawnId: string;
  position: number;
  isHome: boolean;
}

export interface PlayerState {
  clientKey: string;
  sessionId: string;
  playerId: string;
  slotIndex: number;
  startIndex: number;
  playerPosition: PlayerPositionName;
  pawns: PawnState[];
  connected: boolean;
  isBot: boolean;
  turnTimeoutHandle: NodeJS.Timeout | null;
  botActionHandle: NodeJS.Timeout | null;
}
