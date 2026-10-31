import express from "express";
import { adminAuth } from "./dashboard/adminAuth";
import { getDashboardHtml } from "./dashboardHtml";
import { getActiveRooms, getRoomByCode, getRoomSnapshot, getRoomStats, normalizeRoomCode } from "./roomMatchmakingRegistry";
import { getServerLogs, recordServerLog, subscribeServerLogs } from "./serverLog";
import {
  getDefaultDiceAiConfig,
  getDiceAiConfig,
  getDiceAiConfigLimits,
  resetDiceAiConfig,
  updateDiceAiConfig
} from "./serverDiceAiConfig";
import {
  getDefaultTimingConfig,
  getTimingConfig,
  getTimingConfigLimits,
  resetTimingConfig,
  updateTimingConfig
} from "./serverTimingConfig";

interface DashboardSnapshotPlayer {
  playerId?: unknown;
  clientKey?: unknown;
  connected?: unknown;
  slotIndex?: unknown;
  profile?: unknown;
}

interface DashboardSnapshot {
  players?: unknown;
}

export function setupDashboard(app: express.Application) {
  app.use(express.json({ limit: "20kb" }));

  app.get("/favicon.ico", (_request, response) => {
    response.status(204).send();
  });

  // The page is open (a browser cannot send a header on navigation); it holds no data and
  // prompts for the key that every data route below requires.
  app.get("/", (_request, response) => {
    response.type("html").send(getDashboardHtml());
  });

  app.get("/stats", adminAuth, (_request, response) => {
    response.json(getRoomStats());
  });

  app.get("/rooms", adminAuth, (_request, response) => {
    response.json(getActiveRooms());
  });

  app.post("/rooms/exists", (request, response) => {
    const roomCode = getRequestRoomCode(request.body);
    if (roomCode.length !== 4) {
      response.status(400).json({ error: "valid roomCode is required" });
      return;
    }

    const room = getRoomByCode(roomCode);
    response.json({
      roomCode,
      exists: room != null,
      status: room != null ? room.status : "",
      expectedPlayerCount: room != null ? room.expectedPlayerCount : 0
    });
  });

  app.post("/rooms/player-active", (request, response) => {
    const clientKey = getRequestClientKey(request.body);
    if (clientKey.length === 0) {
      response.status(400).json({ error: "clientKey is required" });
      return;
    }

    const rooms = getActiveRooms()
      .map((room) => {
        const matchedPlayers = getSnapshotPlayers(getRoomSnapshot(room.roomCode));

        if (!matchedPlayers.some((player) => player.clientKey === clientKey)) {
          return null;
        }

        return {
          ...room,
          matchedPlayers
        };
      })
      .filter((room): room is NonNullable<typeof room> => room != null);

    response.json({
      clientKey,
      count: rooms.length,
      rooms
    });
  });

  app.get("/config/timing", adminAuth, (_request, response) => {
    response.json({
      config: getTimingConfig(),
      defaults: getDefaultTimingConfig(),
      limits: getTimingConfigLimits()
    });
  });

  app.post("/config/timing", adminAuth, (request, response) => {
    const config = request.body != null && request.body.reset === true
      ? resetTimingConfig()
      : updateTimingConfig(request.body);

    recordServerLog("Dashboard", "timing_config_updated", {
      reset: request.body != null && request.body.reset === true,
      config
    });

    response.json({
      config,
      defaults: getDefaultTimingConfig(),
      limits: getTimingConfigLimits()
    });
  });

  app.get("/config/dice-ai", adminAuth, (_request, response) => {
    response.json({
      config: getDiceAiConfig(),
      defaults: getDefaultDiceAiConfig(),
      limits: getDiceAiConfigLimits()
    });
  });

  app.post("/config/dice-ai", adminAuth, (request, response) => {
    const config = request.body != null && request.body.reset === true
      ? resetDiceAiConfig()
      : updateDiceAiConfig(request.body);

    recordServerLog("Dashboard", "dice_ai_config_updated", {
      reset: request.body != null && request.body.reset === true,
      config
    });

    response.json({
      config,
      defaults: getDefaultDiceAiConfig(),
      limits: getDiceAiConfigLimits()
    });
  });

  app.get("/rooms/:roomCode/state", adminAuth, (request, response) => {
    const snapshot = getRoomSnapshot(request.params.roomCode);
    if (snapshot == null) {
      response.status(404).json({ error: "Room not found" });
      return;
    }

    response.json(snapshot);
  });

  app.get("/rooms/:roomCode/logs", adminAuth, (request, response) => {
    const roomCode = normalizeRoomCode(request.params.roomCode);
    response.json(getServerLogs().filter((entry) => getLogRoomCode(entry.details) === roomCode));
  });

  app.get("/logs", adminAuth, (_request, response) => {
    response.json(getServerLogs());
  });

  app.get("/events", adminAuth, (request, response) => {
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream"
    });
    response.write("\n");

    const unsubscribe = subscribeServerLogs((entry) => {
      response.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    request.on("close", unsubscribe);
  });
}

function getRequestClientKey(body: unknown): string {
  if (body == null || typeof body !== "object" || !("clientKey" in body)) {
    return "";
  }

  const value = (body as { clientKey?: unknown }).clientKey;
  return typeof value === "string" ? value.trim() : "";
}

function getRequestRoomCode(body: unknown): string {
  if (body == null || typeof body !== "object" || !("roomCode" in body)) {
    return "";
  }

  const value = (body as { roomCode?: unknown }).roomCode;
  return typeof value === "string" ? normalizeRoomCode(value) : "";
}

function getSnapshotPlayers(snapshot: unknown) {
  if (snapshot == null || typeof snapshot !== "object") {
    return [];
  }

  const players = (snapshot as DashboardSnapshot).players;
  if (!Array.isArray(players)) {
    return [];
  }

  return players
    .filter(isDashboardSnapshotPlayer)
    .map((player) => ({
      playerId: typeof player.playerId === "string" ? player.playerId : "",
      clientKey: typeof player.clientKey === "string" ? player.clientKey : "",
      connected: player.connected === true,
      slotIndex: typeof player.slotIndex === "number" ? player.slotIndex : 0,
      profile: player.profile ?? null
    }));
}

function isDashboardSnapshotPlayer(value: unknown): value is DashboardSnapshotPlayer {
  return value != null && typeof value === "object";
}

function getLogRoomCode(details: unknown): string {
  if (details == null || typeof details !== "object" || !("roomCode" in details)) {
    return "";
  }

  return normalizeRoomCode(String((details as { roomCode?: unknown }).roomCode || ""));
}
