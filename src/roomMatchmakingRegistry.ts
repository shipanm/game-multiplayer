export type MatchMode = "host" | "join";
export type MatchRoomStatus = "waiting" | "playing" | "full" | "disposed";

export interface MatchRoomSummary {
  roomCode: string;
  roomId: string;
  matchMode: MatchMode;
  playerCount: number;
  connectedPlayerCount: number;
  expectedPlayerCount: number;
  pawnCount: number;
  commonTrackCount: number;
  commonPathCount: number;
  totalMoveCount: number;
  status: MatchRoomStatus;
  updatedAt: number;
}

type RoomSnapshotProvider = () => unknown;

const roomsByCode = new Map<string, MatchRoomSummary>();
const snapshotProvidersByCode = new Map<string, RoomSnapshotProvider>();
const ROOM_CODE_LENGTH = 4;
const EASY_ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const RANDOM_ROOM_CODE_ATTEMPTS = 128;

export function normalizeRoomCode(value?: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function normalizeMatchMode(value?: string): MatchMode {
  if (value === "join") {
    return value;
  }

  return "host";
}

export function generateRoomCode(): string {
  for (let attempt = 0; attempt < RANDOM_ROOM_CODE_ATTEMPTS; attempt++) {
    const code = generateRandomEasyRoomCode();
    if (!isActiveRoomCode(code)) {
      return code;
    }
  }

  const maxCodes = Math.pow(EASY_ROOM_CODE_ALPHABET.length, ROOM_CODE_LENGTH);
  const startOffset = Math.floor(Math.random() * maxCodes);
  for (let value = 0; value < maxCodes; value++) {
    const code = buildEasyRoomCode((startOffset + value) % maxCodes);
    if (!isActiveRoomCode(code)) {
      return code;
    }
  }

  throw new Error("No available easy room codes.");
}

function generateRandomEasyRoomCode(): string {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index++) {
    code += EASY_ROOM_CODE_ALPHABET[Math.floor(Math.random() * EASY_ROOM_CODE_ALPHABET.length)];
  }

  return code;
}

function buildEasyRoomCode(value: number): string {
  let nextValue = value;
  let code = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index++) {
    code = EASY_ROOM_CODE_ALPHABET[nextValue % EASY_ROOM_CODE_ALPHABET.length] + code;
    nextValue = Math.floor(nextValue / EASY_ROOM_CODE_ALPHABET.length);
  }

  return code;
}

export function isActiveRoomCode(roomCode: string): boolean {
  const room = roomsByCode.get(normalizeRoomCode(roomCode));
  return room != null && room.status !== "disposed";
}

export function getRoomByCode(roomCode: string): MatchRoomSummary | null {
  const room = roomsByCode.get(normalizeRoomCode(roomCode));
  return room != null && room.status !== "disposed" ? room : null;
}

export function getActiveRooms(): MatchRoomSummary[] {
  return [...roomsByCode.values()]
    .filter((room) => room.status !== "disposed")
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function getRoomStats() {
  const activeRooms = getActiveRooms();
  return {
    totalRoomCount: activeRooms.length,
    ccu: activeRooms.reduce((total, room) => total + room.connectedPlayerCount, 0)
  };
}

export function registerRoomSnapshotProvider(roomCode: string, provider: RoomSnapshotProvider) {
  snapshotProvidersByCode.set(normalizeRoomCode(roomCode), provider);
}

export function unregisterRoomSnapshotProvider(roomCode: string) {
  snapshotProvidersByCode.delete(normalizeRoomCode(roomCode));
}

export function getRoomSnapshot(roomCode: string): unknown | null {
  const provider = snapshotProvidersByCode.get(normalizeRoomCode(roomCode));
  return provider != null ? provider() : null;
}

export function registerOrUpdateRoom(summary: Omit<MatchRoomSummary, "updatedAt">): MatchRoomSummary {
  const normalizedRoomCode = normalizeRoomCode(summary.roomCode);
  const nextSummary: MatchRoomSummary = {
    ...summary,
    roomCode: normalizedRoomCode,
    updatedAt: Date.now()
  };

  roomsByCode.set(normalizedRoomCode, nextSummary);
  return nextSummary;
}

export function markRoomDisposed(roomCode: string) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  const room = roomsByCode.get(normalizedRoomCode);
  if (room == null) {
    return;
  }

  roomsByCode.set(normalizedRoomCode, {
    ...room,
    status: "disposed",
    updatedAt: Date.now()
  });
  unregisterRoomSnapshotProvider(normalizedRoomCode);
}
