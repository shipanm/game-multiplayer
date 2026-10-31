import { Client, Room, ServerError } from "colyseus";
import {
  generateRoomCode,
  isActiveRoomCode,
  markRoomDisposed,
  MatchMode,
  MatchRoomStatus,
  normalizeMatchMode,
  normalizeRoomCode,
  registerOrUpdateRoom,
  registerRoomSnapshotProvider
} from "../roomMatchmakingRegistry";
import { recordServerLog } from "../serverLog";
import { getTimingConfig, MultiplayerAnimationConfigMessage } from "../serverTimingConfig";
import { isValidChatMessage, normalizeChatMessage } from "./ludoChat";
import { chooseLudoBotPawn } from "./ludoBotAi";
import { ServerDiceAi } from "./ludoDiceAi";
import {
  createServerPlayerId,
  getBotStatuses,
  getDashboardPlayers,
  getNextAvailableSlotIndex,
  getPlayerProfiles,
  resolveClientKey,
  resolvePlayerPosition,
  resolvePlayerProfile,
  resolvePlayerStartIndex
} from "./ludoPlayers";
import {
  areAllPawnsHome,
  createPawns,
  findCapturedPawn,
  findCapturedPawnAtBoardIndex,
  getBoardIndex,
  getLegalPawnIds,
  getNextConsecutiveSixCount,
  toGlobalPosition
} from "./ludoRules";
import { buildDashboardSnapshot, buildGameStartedMessage, buildRoomStateSnapshot } from "./ludoSnapshots";
import { secondsToTimerMs } from "./ludoTimers";
import { resolveTurnReplay } from "./ludoTurnBonus";
import type {
  ChatDataMessage,
  DiceRollRequestMessage,
  JoinOptions,
  PawnMoveRequestMessage,
  PawnState,
  PlayerProfileMessage,
  PlayerState,
  SyncStateRequestMessage
} from "./ludoTypes";

const DEFAULT_SAFE_POINT_INDEXES = [0, 8, 13, 21, 26, 34, 39, 47];

export class LudoRoom extends Room {
  maxClients = 6;

  private players: PlayerState[] = [];
  private sessionToPlayerId = new Map<string, string>();
  private clientKeyToPlayerId = new Map<string, string>();
  private playerProfiles = new Map<string, PlayerProfileMessage>();
  private currentPlayerIndex = -1;
  private currentDiceNumber = 0;
  private activePawnIds: string[] = [];
  private consecutiveSixCounts = new Map<string, number>();
  private queuedBonusTurns = new Map<string, number>();
  private pawnCount = 4;
  private totalMoveCount = 56;
  private commonTrackCount = 52;
  private commonPathCount = 51;
  private safePointIndexes = new Set<number>(DEFAULT_SAFE_POINT_INDEXES);
  private hasGameStarted = false;
  private expectedPlayerCount = 2;
  private isGameOver = false;
  private winnerPlayerIds: string[] = [];
  private turnSequence = 0;
  private matchMode: MatchMode = "host";
  private roomCode = "";
  private readonly animationConfig: MultiplayerAnimationConfigMessage = getTimingConfig();
  private readonly diceAi = new ServerDiceAi();

  requestJoin(options: JoinOptions = {}, isNewRoom: boolean) {
    const matchMode = normalizeMatchMode(options.matchMode);
    const compatibility = this.getCompatibilityOptions(options);

    if (isNewRoom) {
      return matchMode === "host";
    }

    const reconnectPlayerId = this.getExistingPlayerIdForClientKey(options);
    if (reconnectPlayerId != null) {
      return this.isCompatibleMatch(compatibility);
    }

    if (this.isMatchingJoinRoomCode(options) && this.isReservedForExistingPlayers()) {
      this.log("room_full_join_rejected", {
        roomCode: this.roomCode,
        clientKey: options.clientKey || "",
        playerCount: this.players.length,
        expectedPlayerCount: this.expectedPlayerCount,
        connectedPlayerCount: this.players.filter((player) => player.connected).length,
        hasGameStarted: this.hasGameStarted,
        isGameOver: this.isGameOver
      });
      throw new ServerError(400, "Room Full");
    }

    if (this.hasGameStarted || this.isGameOver || this.players.length >= this.expectedPlayerCount) {
      return false;
    }

    return matchMode === "join" &&
      this.roomCode === normalizeRoomCode(options.roomCode) &&
      this.isCompatibleMatch(compatibility);
  }

  onCreate(options: JoinOptions = {}) {
    this.matchMode = normalizeMatchMode(options.matchMode);
    this.pawnCount = Math.max(1, Math.min(6, Number(options.pawnCount || this.pawnCount)));
    this.totalMoveCount = Math.max(1, Number(options.totalMoveCount || this.totalMoveCount));
    this.commonTrackCount = Math.max(1, Number(options.commonTrackCount || this.commonTrackCount));
    this.commonPathCount = Math.max(1, Number(options.commonPathCount || this.commonPathCount));
    this.safePointIndexes = this.resolveSafePointIndexes(options);
    this.expectedPlayerCount = this.resolveExpectedPlayerCount(options);
    this.roomCode = this.resolveRoomCode(options);
    this.maxClients = this.expectedPlayerCount;
    registerRoomSnapshotProvider(this.roomCode, () => this.getDashboardSnapshot());
    this.updateMatchRegistry("waiting");

    this.log("room created", {
      roomCode: this.roomCode,
      matchMode: this.matchMode,
      expectedPlayerCount: this.expectedPlayerCount,
      pawnCount: this.pawnCount,
      commonTrackCount: this.commonTrackCount,
      commonPathCount: this.commonPathCount,
      safePointIndexes: [...this.safePointIndexes],
      totalMoveCount: this.totalMoveCount,
      animationConfig: this.getAnimationConfig()
    });

    this.onMessage("dice_roll_request", (client, message: DiceRollRequestMessage) => {
      this.handleDiceRollRequest(client, message);
    });

    this.onMessage("pawn_move_request", (client, message: PawnMoveRequestMessage) => {
      this.handlePawnMoveRequest(client, message);
    });

    this.onMessage("sync_state_request", (client, message: SyncStateRequestMessage = {}) => {
      this.handleSyncStateRequest(client, message);
    });

    this.onMessage("chat_request", (client, message: ChatDataMessage = {}) => {
      this.handleChatRequest(client, message);
    });
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const playerId = this.resolvePlayerId(client, options);
    const clientKey = this.resolveClientKey(client, options);
    const existingPlayerIndex = this.players.findIndex((player) => player.playerId === playerId);
    const slotIndex = existingPlayerIndex >= 0 ? this.players[existingPlayerIndex].slotIndex : this.players.length;
    const startIndex = this.resolvePlayerStartIndex(slotIndex, options);
    const playerPosition = this.resolvePlayerPosition(slotIndex);
    const playerProfile = this.resolvePlayerProfile(playerId, options.playerProfile);
    this.log("client joined", {
      sessionId: client.sessionId,
      clientKey,
      playerId,
      roomCode: this.roomCode,
      matchMode: this.matchMode,
      playerName: playerProfile.playerName || "",
      startIndex,
      playerPosition,
      pawnCount: this.pawnCount,
      totalMoveCount: this.totalMoveCount,
      commonTrackCount: this.commonTrackCount,
      safePointIndexes: [...this.safePointIndexes],
      expectedPlayerCount: this.expectedPlayerCount,
      requestedPlayerIds: options.playerIds || [],
      requestedPlayerStartIndexes: options.playerStartIndexes || []
    });

    if (!this.players.some((player) => player.playerId === playerId)) {
      this.players.push({
        clientKey,
        sessionId: client.sessionId,
        playerId,
        slotIndex,
        startIndex,
        playerPosition,
        pawns: createPawns(playerId, this.pawnCount),
        connected: true,
        isBot: false,
        turnTimeoutHandle: null,
        botActionHandle: null
      });
    } else {
      const existingPlayer = this.players.find((player) => player.playerId === playerId);
      if (existingPlayer != null) {
        existingPlayer.clientKey = clientKey;
        existingPlayer.sessionId = client.sessionId;
        existingPlayer.slotIndex = slotIndex;
        existingPlayer.startIndex = startIndex;
        existingPlayer.playerPosition = playerPosition;
        existingPlayer.connected = true;
        this.log("player_reconnected", {
          playerId: existingPlayer.playerId,
          isBot: existingPlayer.isBot
        });
      }
    }

    this.sessionToPlayerId.set(client.sessionId, playerId);
    this.clientKeyToPlayerId.set(clientKey, playerId);
    this.playerProfiles.set(playerId, playerProfile);
    this.updateMatchRegistry(this.players.length >= this.expectedPlayerCount ? "full" : "waiting");

    client.send("room_joined", {
      roomCode: this.roomCode,
      clientKey,
      localPlayerId: playerId,
      playerIds: this.players.map((player) => player.playerId),
      playerProfiles: this.getPlayerProfiles(),
      botStatuses: this.getBotStatuses(),
      animationConfig: this.getAnimationConfig()
    });

    client.send("room_state", this.getSnapshotForClient(client));

    if (!this.hasGameStarted && this.players.length >= this.expectedPlayerCount) {
      this.hasGameStarted = true;
      this.updateMatchRegistry("playing");
      this.log("game started", { roomCode: this.roomCode, playerIds: this.players.map((player) => player.playerId) });
      this.sendGameStartedToAllClients();
      this.startTurn(0);
    } else if (!this.hasGameStarted) {
      this.log("waiting_for_players", {
        connectedPlayerCount: this.players.length,
        expectedPlayerCount: this.expectedPlayerCount
      });
    }
  }

  onLeave(client: Client) {
    const playerId = this.sessionToPlayerId.get(client.sessionId) || null;
    const player = playerId != null ? this.players.find((candidate) => candidate.playerId === playerId) || null : null;
    this.log("client left", {
      sessionId: client.sessionId,
      playerId
    });

    if (player != null) {
      player.connected = false;
      this.clearPlayerTimers(player);
      this.enableBot(player, "player_left");

      if (this.hasGameStarted && !this.isGameOver && this.isCurrentPlayer(player.playerId)) {
        this.scheduleBotAction(player, "player_left_on_turn");
      }
    }

    this.sessionToPlayerId.delete(client.sessionId);
    this.updateMatchRegistry(this.hasGameStarted ? "playing" : this.players.length >= this.expectedPlayerCount ? "full" : "waiting");
  }

  onDispose() {
    this.clearAllBotTimers();
    markRoomDisposed(this.roomCode);
    this.log("room disposed");
  }

  private handleDiceRollRequest(client: Client, message: DiceRollRequestMessage) {
    this.log("dice_roll_request", {
      sessionId: client.sessionId,
      requestedPlayerId: message.playerId,
      currentPlayerId: this.getCurrentPlayerId()
    });

    const player = this.getRequestPlayer(client, message.playerId);
    if (player == null || !this.isCurrentPlayer(player.playerId)) {
      this.sendError(client, "It is not this player's turn.");
      return;
    }

    if (this.currentDiceNumber > 0) {
      this.sendError(client, "Dice has already been rolled for this turn.");
      return;
    }

    this.disableBot(player, "human_dice_roll_request");
    this.rollForPlayer(player, "human");
  }

  private handlePawnMoveRequest(client: Client, message: PawnMoveRequestMessage) {
    this.log("pawn_move_request", {
      sessionId: client.sessionId,
      requestedPlayerId: message.playerId,
      pawnId: message.pawnId,
      currentPlayerId: this.getCurrentPlayerId(),
      activePawnIds: this.activePawnIds
    });

    const player = this.getRequestPlayer(client, message.playerId);
    if (player == null || !this.isCurrentPlayer(player.playerId)) {
      this.sendError(client, "It is not this player's turn.");
      return;
    }

    if (!this.activePawnIds.includes(message.pawnId)) {
      this.sendError(client, "That pawn cannot move for the current dice.");
      return;
    }

    const pawn = player.pawns.find((candidate) => candidate.pawnId === message.pawnId);
    if (pawn == null) {
      this.sendError(client, "Pawn not found.");
      return;
    }

    this.disableBot(player, "human_pawn_move_request");
    this.movePawnForPlayer(player, pawn, "human");
  }

  private handleSyncStateRequest(client: Client, message: SyncStateRequestMessage) {
    this.log("sync_state_request", {
      sessionId: client.sessionId,
      playerId: this.sessionToPlayerId.get(client.sessionId) || null,
      reason: message.reason || ""
    });

    client.send("room_state", this.getSnapshotForClient(client));
  }

  private handleChatRequest(client: Client, message: ChatDataMessage) {
    const sessionPlayerId = this.sessionToPlayerId.get(client.sessionId) || "";
    const { requestedPlayerId, messageType, data } = normalizeChatMessage(message);

    this.log("chat_request", {
      sessionId: client.sessionId,
      sessionPlayerId,
      requestedPlayerId,
      messageType,
      data
    });

    if (sessionPlayerId.length === 0 || requestedPlayerId !== sessionPlayerId) {
      this.sendError(client, "Invalid chat player.");
      return;
    }

    if (!isValidChatMessage(messageType, data)) {
      this.sendError(client, "Invalid chat message.");
      return;
    }

    const chatMessage: ChatDataMessage = {
      playerId: sessionPlayerId,
      messageType,
      data
    };

    this.broadcast("chat_message", chatMessage);
    this.log("chat_message", {
      playerId: chatMessage.playerId || "",
      messageType: chatMessage.messageType || "",
      data: chatMessage.data || ""
    });
  }

  private rollForPlayer(player: PlayerState, source: "human" | "bot") {
    if (this.isGameOver || !this.isCurrentPlayer(player.playerId)) {
      return;
    }

    this.clearPlayerTurnTimeout(player);
    this.currentDiceNumber = this.diceAi.roll({
      players: this.players,
      player,
      totalMoveCount: this.totalMoveCount,
      commonPathCount: this.commonPathCount,
      commonTrackCount: this.commonTrackCount,
      safePointIndexes: this.safePointIndexes,
      consecutiveSixCount: this.getConsecutiveSixCount(player.playerId)
    });
    this.updateConsecutiveSixCount(player, this.currentDiceNumber);
    this.log("dice_rolled", {
      playerId: player.playerId,
      diceNumber: this.currentDiceNumber,
      source,
      consecutiveSixCount: this.getConsecutiveSixCount(player.playerId)
    });

    this.broadcast("dice_rolled", {
      playerId: player.playerId,
      diceNumbers: [this.currentDiceNumber]
    });

    if (this.getConsecutiveSixCount(player.playerId) >= 3) {
      this.activePawnIds = [];
      this.consecutiveSixCounts.set(player.playerId, 0);
      this.queuedBonusTurns.set(player.playerId, 0);
      this.log("three_six_turn_forfeit", {
        playerId: player.playerId,
        source,
        queuedBonusTurns: 0
      });

      this.broadcast("pawn_move_available", {
        playerId: player.playerId,
        pawnIds: this.activePawnIds
      });

      this.scheduleTurnEndAfterDiceOnly(player, "three_six_turn_forfeit");
      return;
    }

    this.activePawnIds = getLegalPawnIds(player, this.currentDiceNumber, this.totalMoveCount);
    this.log("pawn_move_available", {
      playerId: player.playerId,
      pawnIds: this.activePawnIds,
      source
    });

    this.broadcast("pawn_move_available", {
      playerId: player.playerId,
      pawnIds: this.activePawnIds
    });

    if (this.activePawnIds.length === 0) {
      this.log("no legal pawn moves", { playerId: player.playerId, source });
      this.scheduleTurnEndAfterDiceOnly(player, "no_legal_pawn_moves");
      return;
    }

    if (source === "bot") {
      this.scheduleBotAction(player, "bot_choose_pawn");
    }
  }

  private movePawnForPlayer(player: PlayerState, pawn: PawnState, source: "human" | "bot") {
    if (this.isGameOver || !this.isCurrentPlayer(player.playerId)) {
      return;
    }

    this.clearPlayerBotAction(player);
    pawn.position = pawn.position < 0 ? 0 : pawn.position + this.currentDiceNumber;
    pawn.isHome = pawn.position >= this.totalMoveCount;
    this.log("pawn_moved", {
      playerId: player.playerId,
      pawnId: pawn.pawnId,
      diceNumber: this.currentDiceNumber,
      pointIndex: toGlobalPosition(player, pawn, this.commonPathCount, this.commonTrackCount),
      isHome: pawn.isHome,
      source
    });

    this.broadcast("pawn_moved", {
      playerId: player.playerId,
      pawnId: pawn.pawnId,
      diceNumber: this.currentDiceNumber,
      pointIndex: toGlobalPosition(player, pawn, this.commonPathCount, this.commonTrackCount)
    });

    const capturedPawn = findCapturedPawn(
      this.players,
      player,
      pawn,
      this.safePointIndexes,
      this.commonPathCount,
      this.commonTrackCount
    );
    if (capturedPawn != null) {
      const capturedOwner = this.getPawnOwner(capturedPawn);
      capturedPawn.position = -1;
      capturedPawn.isHome = false;
      this.log("pawn_death", {
        playerId: capturedOwner?.playerId || null,
        pawnId: capturedPawn.pawnId,
        capturedByPlayerId: player.playerId,
        boardIndex: getBoardIndex(player, pawn, this.commonPathCount, this.commonTrackCount),
        source
      });
      this.broadcast("pawn_death", {
        playerId: capturedOwner?.playerId,
        pawnId: capturedPawn.pawnId
      });
    }

    if (areAllPawnsHome(player)) {
      this.winnerPlayerIds = [player.playerId];
      this.log("game_over", { winnerPlayerIds: this.winnerPlayerIds });
      this.isGameOver = true;
      this.clearAllBotTimers();
      this.broadcast("game_over", {
        winnerPlayerIds: this.winnerPlayerIds
      });
      return;
    }

    const earnedBonusTurns = (capturedPawn != null ? 1 : 0) + (pawn.isHome ? 1 : 0);
    this.endTurn(player.playerId, this.currentDiceNumber === 6, earnedBonusTurns);
  }

  private startTurn(index: number) {
    if (this.players.length === 0 || this.isGameOver) {
      return;
    }

    this.clearAllBotTimers();
    this.currentPlayerIndex = ((index % this.players.length) + this.players.length) % this.players.length;
    this.turnSequence += 1;
    this.currentDiceNumber = 0;
    this.activePawnIds = [];
    const currentPlayer = this.players[this.currentPlayerIndex];

    this.log("turn_started", {
      playerId: currentPlayer.playerId,
      turnSequence: this.turnSequence,
      turnIndex: this.currentPlayerIndex,
      connected: currentPlayer.connected,
      isBot: currentPlayer.isBot
    });

    this.broadcast("turn_started", {
      playerId: currentPlayer.playerId,
      turnSequence: this.turnSequence
    });

    this.scheduleTurnTimeout(currentPlayer);
    this.sendRoomStateToAllClients("turn_started");
  }

  private endTurn(playerId: string, rolledSix: boolean, earnedBonusTurns = 0, forceAdvance = false) {
    if (this.isGameOver) {
      return;
    }

    const player = this.players.find((candidate) => candidate.playerId === playerId);
    if (player != null) {
      this.clearPlayerTimers(player);
    }

    const previousQueuedBonusTurns = this.getQueuedBonusTurns(playerId);
    const replayResolution = resolveTurnReplay(
      previousQueuedBonusTurns,
      rolledSix,
      earnedBonusTurns,
      forceAdvance
    );
    const { playAgain, queuedBonusTurns, replayReason } = replayResolution;
    this.queuedBonusTurns.set(playerId, queuedBonusTurns);

    if (!playAgain) {
      this.consecutiveSixCounts.set(playerId, 0);
    }

    this.log("turn_ended", {
      playerId,
      playAgain,
      rolledSix,
      earnedBonusTurns,
      previousQueuedBonusTurns,
      queuedBonusTurns,
      replayReason,
      turnSequence: this.turnSequence,
      nextPlayerId: playAgain ? playerId : this.peekNextPlayerId()
    });

    this.broadcast("turn_ended", {
      playerId,
      turnSequence: this.turnSequence,
      nextPlayerId: playAgain ? playerId : this.peekNextPlayerId()
    });

    if (playAgain) {
      this.startTurn(this.currentPlayerIndex);
    } else {
      this.startTurn(this.currentPlayerIndex + 1);
    }
  }

  private findCapturedPawnAtBoardIndex(currentPlayer: PlayerState, movedBoardIndex: number | null): PawnState | null {
    return findCapturedPawnAtBoardIndex(
      this.players,
      currentPlayer,
      movedBoardIndex,
      this.safePointIndexes,
      this.commonPathCount,
      this.commonTrackCount
    );
  }

  private scheduleTurnTimeout(player: PlayerState) {
    this.clearPlayerTimers(player);

    if (player.isBot || !player.connected) {
      this.enableBot(player, player.connected ? "bot_player_turn" : "disconnected_player_turn");
      this.scheduleBotAction(player, player.connected ? "bot_player_turn" : "disconnected_player_turn");
      return;
    }

    player.turnTimeoutHandle = setTimeout(() => {
      if (this.isGameOver || !this.isCurrentPlayer(player.playerId)) {
        return;
      }

      this.enableBot(player, "turn_timeout");
      this.scheduleBotAction(player, "turn_timeout");
    }, this.getTurnTimeoutMs());

    this.log("turn_timeout_started", {
      playerId: player.playerId,
      timeoutMs: this.getTurnTimeoutMs()
    });
  }

  private scheduleBotAction(player: PlayerState, reason: string) {
    this.clearPlayerBotAction(player);
    const delayMs = this.getBotTurnActionDelayMs();

    player.botActionHandle = setTimeout(() => {
      this.runBotTurn(player.playerId, reason);
    }, delayMs);

    this.log("bot_action_scheduled", {
      playerId: player.playerId,
      delayMs,
      reason
    });
  }

  private scheduleTurnEndAfterDiceOnly(player: PlayerState, reason: string) {
    this.clearPlayerBotAction(player);
    const playerId = player.playerId;
    const diceNumber = this.currentDiceNumber;

    player.botActionHandle = setTimeout(() => {
      if (this.isGameOver || !this.isCurrentPlayer(playerId) || this.currentDiceNumber !== diceNumber) {
        return;
      }

      this.endTurn(playerId, false, 0, true);
    }, this.getNoMoveTurnEndDelayMs());

    this.log("turn_end_after_dice_scheduled", {
      playerId,
      reason,
      diceNumber,
      delayMs: this.getNoMoveTurnEndDelayMs()
    });
  }

  private runBotTurn(playerId: string, reason: string) {
    const player = this.players.find((candidate) => candidate.playerId === playerId);
    if (player == null || this.isGameOver || !this.isCurrentPlayer(player.playerId)) {
      return;
    }

    if (!player.isBot && player.connected) {
      return;
    }

    this.log("bot_action_run", {
      playerId: player.playerId,
      reason,
      diceNumber: this.currentDiceNumber,
      activePawnIds: this.activePawnIds
    });

    if (this.currentDiceNumber <= 0) {
      this.rollForPlayer(player, "bot");
      return;
    }

    const pawn = chooseLudoBotPawn({
      players: this.players,
      player,
      activePawnIds: this.activePawnIds,
      diceNumber: this.currentDiceNumber,
      totalMoveCount: this.totalMoveCount,
      commonPathCount: this.commonPathCount,
      commonTrackCount: this.commonTrackCount,
      safePointIndexes: this.safePointIndexes
    });
    if (pawn == null) {
      this.log("bot_no_pawn_selected", { playerId: player.playerId });
      this.endTurn(player.playerId, false, 0, true);
      return;
    }

    this.movePawnForPlayer(player, pawn, "bot");
  }

  private enableBot(player: PlayerState, reason: string) {
    this.setBotStatus(player, true, reason);
  }

  private disableBot(player: PlayerState, reason: string) {
    this.setBotStatus(player, false, reason);
  }

  private setBotStatus(player: PlayerState, isBot: boolean, reason: string) {
    if (player.isBot === isBot) {
      return;
    }

    player.isBot = isBot;
    this.log(isBot ? "bot_enabled" : "bot_disabled", {
      playerId: player.playerId,
      connected: player.connected,
      reason
    });

    this.broadcast("bot_status_changed", {
      playerId: player.playerId,
      isBot
    });
  }

  private clearPlayerTimers(player: PlayerState) {
    this.clearPlayerTurnTimeout(player);
    this.clearPlayerBotAction(player);
  }

  private clearPlayerTurnTimeout(player: PlayerState) {
    if (player.turnTimeoutHandle != null) {
      clearTimeout(player.turnTimeoutHandle);
      player.turnTimeoutHandle = null;
    }
  }

  private clearPlayerBotAction(player: PlayerState) {
    if (player.botActionHandle != null) {
      clearTimeout(player.botActionHandle);
      player.botActionHandle = null;
    }
  }

  private clearAllBotTimers() {
    for (const player of this.players) {
      this.clearPlayerTimers(player);
    }
  }

  private resolvePlayerProfile(playerId: string, profile?: PlayerProfileMessage): PlayerProfileMessage {
    return resolvePlayerProfile(playerId, profile);
  }

  private getPlayerProfiles(): PlayerProfileMessage[] {
    return getPlayerProfiles(this.players, this.playerProfiles);
  }

  private getBotStatuses(): Array<{ playerId: string; isBot: boolean }> {
    return getBotStatuses(this.players);
  }

  private resolvePlayerId(client: Client, options: JoinOptions): string {
    if (options.playerId != null && options.playerId.length > 0) {
      this.log("client_player_id_ignored", {
        sessionId: client.sessionId,
        requestedPlayerId: options.playerId
      });
    }

    const clientKey = this.resolveClientKey(client, options);
    const existingPlayerId = this.clientKeyToPlayerId.get(clientKey);
    if (existingPlayerId != null) {
      return existingPlayerId;
    }

    return this.createServerPlayerId(this.getNextAvailableSlotIndex());
  }

  private getExistingPlayerIdForClientKey(options: JoinOptions): string | null {
    const clientKey = options.clientKey;
    if (clientKey == null || clientKey.length === 0) {
      return null;
    }

    return this.clientKeyToPlayerId.get(clientKey) || null;
  }

  private isMatchingJoinRoomCode(options: JoinOptions): boolean {
    return normalizeMatchMode(options.matchMode) === "join" &&
      this.roomCode === normalizeRoomCode(options.roomCode);
  }

  private isReservedForExistingPlayers(): boolean {
    return this.hasGameStarted ||
      this.isGameOver ||
      this.players.length >= this.expectedPlayerCount;
  }

  private resolveClientKey(client: Client, options: JoinOptions): string {
    return resolveClientKey(client.sessionId, options);
  }

  private resolveExpectedPlayerCount(options: JoinOptions): number {
    const expectedPlayerCount = Number(options.expectedPlayerCount);
    if (Number.isInteger(expectedPlayerCount) && expectedPlayerCount > 0) {
      return Math.max(1, Math.min(this.maxClients, expectedPlayerCount));
    }

    if (Array.isArray(options.playerIds) && options.playerIds.length > 0) {
      return Math.max(1, Math.min(this.maxClients, options.playerIds.length));
    }

    if (Array.isArray(options.playerStartIndexes) && options.playerStartIndexes.length > 0) {
      return Math.max(1, Math.min(this.maxClients, options.playerStartIndexes.length));
    }

    return this.expectedPlayerCount;
  }

  private getCompatibilityOptions(options: JoinOptions) {
    return {
      expectedPlayerCount: this.resolveExpectedPlayerCount(options),
      pawnCount: Math.max(1, Math.min(6, Number(options.pawnCount || this.pawnCount))),
      commonTrackCount: Math.max(1, Number(options.commonTrackCount || this.commonTrackCount)),
      commonPathCount: Math.max(1, Number(options.commonPathCount || this.commonPathCount)),
      totalMoveCount: Math.max(1, Number(options.totalMoveCount || this.totalMoveCount)),
      safePointIndexes: this.resolveSafePointIndexes(options)
    };
  }

  private isCompatibleMatch(options: ReturnType<LudoRoom["getCompatibilityOptions"]>): boolean {
    return this.expectedPlayerCount === options.expectedPlayerCount &&
      this.pawnCount === options.pawnCount &&
      this.commonTrackCount === options.commonTrackCount &&
      this.commonPathCount === options.commonPathCount &&
      this.totalMoveCount === options.totalMoveCount &&
      this.areSafePointIndexesCompatible(options.safePointIndexes);
  }

  private resolveSafePointIndexes(options: JoinOptions): Set<number> {
    const safeIndexes = new Set<number>();
    const sourceIndexes = Array.isArray(options.safePointIndexes) && options.safePointIndexes.length > 0
      ? options.safePointIndexes
      : DEFAULT_SAFE_POINT_INDEXES;

    for (const value of sourceIndexes) {
      const index = Number(value);
      if (Number.isInteger(index) && index >= 0 && index < this.commonTrackCount) {
        safeIndexes.add(index);
      }
    }

    return safeIndexes;
  }

  private areSafePointIndexesCompatible(candidateIndexes: Set<number>): boolean {
    if (this.safePointIndexes.size !== candidateIndexes.size) {
      return false;
    }

    for (const index of this.safePointIndexes) {
      if (!candidateIndexes.has(index)) {
        return false;
      }
    }

    return true;
  }

  private resolveRoomCode(options: JoinOptions): string {
    const requestedRoomCode = normalizeRoomCode(options.roomCode);
    if (this.matchMode === "join" && requestedRoomCode.length > 0) {
      if (!isActiveRoomCode(requestedRoomCode)) {
        return requestedRoomCode;
      }

      this.log("active_room_code_replaced", {
        requestedRoomCode
      });
    }

    return generateRoomCode();
  }

  private updateMatchRegistry(status: MatchRoomStatus) {
    if (this.roomCode.length === 0) {
      return;
    }

    registerOrUpdateRoom({
      roomCode: this.roomCode,
      roomId: this.roomId || "unassigned",
      matchMode: this.matchMode,
      playerCount: this.players.length,
      connectedPlayerCount: this.players.filter((player) => player.connected).length,
      expectedPlayerCount: this.expectedPlayerCount,
      pawnCount: this.pawnCount,
      commonTrackCount: this.commonTrackCount,
      commonPathCount: this.commonPathCount,
      totalMoveCount: this.totalMoveCount,
      status
    });
  }

  private sendGameStartedToAllClients() {
    for (const client of this.clients) {
      const localPlayerId = this.sessionToPlayerId.get(client.sessionId) || "";
      const localPlayer = this.players.find((player) => player.playerId === localPlayerId);
      client.send("game_started", buildGameStartedMessage(
        this.getSnapshotContext(),
        localPlayerId,
        localPlayer?.clientKey || ""
      ));
    }
  }

  private sendRoomStateToAllClients(syncReason: string) {
    for (const client of this.clients) {
      client.send("room_state", this.getSnapshotForClient(client, syncReason));
    }
  }

  private getSnapshotForClient(client: Client, syncReason = "manual") {
    const localPlayerId = this.sessionToPlayerId.get(client.sessionId) || "";
    const localPlayer = this.players.find((player) => player.playerId === localPlayerId);

    return buildRoomStateSnapshot(
      this.getSnapshotContext(),
      syncReason,
      localPlayerId,
      localPlayer?.clientKey || ""
    );
  }

  private getDashboardSnapshot() {
    return buildDashboardSnapshot(this.getSnapshotContext());
  }

  private getSnapshotContext() {
    return {
      roomCode: this.roomCode,
      roomId: this.roomId || "unassigned",
      matchMode: this.matchMode,
      players: this.players,
      playerProfiles: this.playerProfiles,
      expectedPlayerCount: this.expectedPlayerCount,
      pawnCount: this.pawnCount,
      commonTrackCount: this.commonTrackCount,
      commonPathCount: this.commonPathCount,
      totalMoveCount: this.totalMoveCount,
      safePointIndexes: this.safePointIndexes,
      animationConfig: this.getAnimationConfig(),
      hasGameStarted: this.hasGameStarted,
      isGameOver: this.isGameOver,
      currentPlayerId: this.getCurrentPlayerId() || "",
      currentDiceNumber: this.currentDiceNumber,
      activePawnIds: this.activePawnIds,
      winnerPlayerIds: this.winnerPlayerIds,
      turnSequence: this.turnSequence
    };
  }

  private getDashboardPlayers() {
    return getDashboardPlayers(this.players, this.playerProfiles);
  }

  private getAnimationConfig(): MultiplayerAnimationConfigMessage {
    return { ...this.animationConfig };
  }

  private getTurnTimeoutMs(): number {
    return secondsToTimerMs(this.animationConfig.turnTimerSeconds);
  }

  private getBotActionDelayMs(): number {
    return secondsToTimerMs(this.animationConfig.botActionDelaySeconds);
  }

  private getBotDiceRollDelayMs(): number {
    return secondsToTimerMs(this.animationConfig.botDiceRollDelaySeconds);
  }

  private getBotTurnActionDelayMs(): number {
    return this.currentDiceNumber <= 0 ? this.getBotDiceRollDelayMs() : this.getBotActionDelayMs();
  }

  private getNoMoveTurnEndDelayMs(): number {
    return secondsToTimerMs(this.animationConfig.noMoveTurnEndDelaySeconds);
  }

  private getNextAvailableSlotIndex(): number {
    return getNextAvailableSlotIndex(this.players, this.maxClients, this.roomCode);
  }

  private createServerPlayerId(slotIndex: number): string {
    return createServerPlayerId(this.roomCode, slotIndex);
  }

  private resolvePlayerStartIndex(slotIndex: number, options: JoinOptions): number {
    return resolvePlayerStartIndex(slotIndex, options, this.commonTrackCount, this.expectedPlayerCount);
  }

  private resolvePlayerPosition(slotIndex: number) {
    return resolvePlayerPosition(slotIndex, this.expectedPlayerCount);
  }

  private getRequestPlayer(client: Client, requestedPlayerId: string): PlayerState | null {
    const sessionPlayerId = this.sessionToPlayerId.get(client.sessionId);
    if (sessionPlayerId == null || sessionPlayerId !== requestedPlayerId) {
      return null;
    }

    return this.players.find((player) => player.playerId === requestedPlayerId) || null;
  }

  private getPawnOwner(targetPawn: PawnState): PlayerState | null {
    return this.players.find((player) => player.pawns.includes(targetPawn)) || null;
  }

  private isCurrentPlayer(playerId: string): boolean {
    return this.currentPlayerIndex >= 0 && this.players[this.currentPlayerIndex]?.playerId === playerId;
  }

  private getCurrentPlayerId(): string | null {
    return this.currentPlayerIndex >= 0 ? this.players[this.currentPlayerIndex]?.playerId || null : null;
  }

  private peekNextPlayerId(): string {
    if (this.players.length === 0) {
      return "";
    }

    return this.players[(this.currentPlayerIndex + 1) % this.players.length].playerId;
  }

  private updateConsecutiveSixCount(player: PlayerState, diceNumber: number) {
    this.consecutiveSixCounts.set(
      player.playerId,
      getNextConsecutiveSixCount(this.getConsecutiveSixCount(player.playerId), diceNumber)
    );
  }

  private getConsecutiveSixCount(playerId: string): number {
    return this.consecutiveSixCounts.get(playerId) || 0;
  }

  private getQueuedBonusTurns(playerId: string): number {
    return this.queuedBonusTurns.get(playerId) || 0;
  }

  private sendError(client: Client, message: string) {
    this.log("error", {
      sessionId: client.sessionId,
      playerId: this.sessionToPlayerId.get(client.sessionId) || null,
      message
    });

    client.send("error", { message });
  }

  private log(eventName: string, details: Record<string, unknown> = {}) {
    const roomId = this.roomId || "unassigned";
    recordServerLog(`LudoRoom:${roomId}`, eventName, {
      roomCode: this.roomCode,
      ...details
    });
  }
}
