export function getDashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LudoBuzz Colyseus Dashboard</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    body { margin: 0; background: #0f1319; color: #e7edf5; }
    header { height: 57px; display: flex; gap: 16px; align-items: center; justify-content: space-between; padding: 14px 18px; background: #171c24; border-bottom: 1px solid #2b3441; }
    h1 { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: 0; }
    h2 { margin: 0 0 10px; font-size: 13px; color: #cbd5e1; }
    button { border: 1px solid #334155; background: #1f2937; color: #e5edf8; border-radius: 6px; padding: 7px 10px; cursor: pointer; text-align: left; }
    button:hover { background: #273244; }
    .status { display: flex; gap: 8px; align-items: center; color: #9fb0c5; font-size: 12px; white-space: nowrap; }
    .dot { width: 9px; height: 9px; border-radius: 999px; background: #f59e0b; box-shadow: 0 0 12px #f59e0b; }
    .dot.connected { background: #22c55e; box-shadow: 0 0 12px #22c55e; }
    .tab-bar { height: 52px; display: flex; align-items: center; gap: 8px; padding: 9px 18px; background: #111821; border-bottom: 1px solid #273140; }
    .tab-button { min-width: 116px; text-align: center; font-weight: 800; color: #9fb0c5; }
    .tab-button.active { border-color: #38bdf8; background: #153147; color: #e7edf5; }
    main { height: calc(100vh - 109px); padding: 14px 18px; overflow: hidden; }
    .tab-panel { height: 100%; min-height: 0; overflow: hidden; }
    .tab-panel.hidden { display: none; }
    .analytics-layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 14px; }
    .analytics-sidebar { min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .controller-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-content: start; overflow-y: auto; padding-right: 4px; }
    .panel { background: #151b24; border: 1px solid #273140; border-radius: 8px; padding: 12px; min-width: 0; min-height: 0; }
    .rooms-panel, .detail-panel { min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .rooms-panel { flex: 1; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .stat { background: #101722; border: 1px solid #283548; border-radius: 8px; padding: 12px; }
    .stat-label { color: #94a3b8; font-size: 12px; }
    .stat-value { margin-top: 4px; font-size: 28px; font-weight: 800; }
    .config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .config-field { display: grid; gap: 4px; min-width: 0; }
    .config-field label { color: #94a3b8; font-size: 11px; line-height: 1.2; }
    .config-field input { width: 100%; border: 1px solid #334155; border-radius: 6px; background: #101722; color: #e7edf5; padding: 7px 8px; font: inherit; font-size: 12px; }
    .config-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    .config-actions button { text-align: center; }
    .config-status { min-width: 0; color: #94a3b8; font-size: 12px; overflow-wrap: anywhere; }
    .room-list { display: grid; gap: 8px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-right: 4px; }
    .room-button { width: 100%; display: grid; gap: 4px; }
    .room-button.active { border-color: #38bdf8; background: #153147; }
    .room-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-weight: 800; }
    .muted { color: #94a3b8; font-size: 12px; }
    .badge { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; border: 1px solid #334155; color: #cbd5e1; }
    .badge.connected { border-color: #166534; color: #86efac; }
    .badge.disconnected { border-color: #7f1d1d; color: #fca5a5; }
    .badge.playing { border-color: #075985; color: #7dd3fc; }
    .badge.waiting { border-color: #854d0e; color: #fde68a; }
    .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 14px; }
    .scroll-column { min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .player-list, .log-list { display: grid; align-content: start; gap: 8px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-right: 4px; }
    .player, .log-entry { background: #101722; border: 1px solid #283548; border-radius: 8px; padding: 10px; min-width: 0; }
    .player-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .player-id, .log-details { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; overflow-wrap: anywhere; white-space: pre-wrap; }
    .log-entry { display: grid; gap: 5px; }
    .log-event { color: #7dd3fc; font-weight: 800; }
    .empty { color: #94a3b8; padding: 20px 4px; text-align: center; }
    .room-list::-webkit-scrollbar, .player-list::-webkit-scrollbar, .log-list::-webkit-scrollbar, .controller-layout::-webkit-scrollbar { width: 8px; }
    .room-list::-webkit-scrollbar-thumb, .player-list::-webkit-scrollbar-thumb, .log-list::-webkit-scrollbar-thumb, .controller-layout::-webkit-scrollbar-thumb { background: #334155; border-radius: 999px; }
    .room-list::-webkit-scrollbar-track, .player-list::-webkit-scrollbar-track, .log-list::-webkit-scrollbar-track, .controller-layout::-webkit-scrollbar-track { background: transparent; }
    @media (max-width: 1000px) {
      html, body { overflow: auto; }
      header { height: auto; min-height: 57px; }
      main { height: auto; min-height: calc(100vh - 109px); overflow: visible; }
      .tab-panel, .analytics-sidebar, .rooms-panel, .detail-panel, .grid, .scroll-column, .controller-layout { overflow: visible; }
      .analytics-layout, .controller-layout, .grid { grid-template-columns: 1fr; }
      .config-grid { grid-template-columns: 1fr; }
      .room-list, .player-list, .log-list { max-height: 50vh; }
    }
  </style>
</head>
<body>
  <header>
    <h1>LudoBuzz Colyseus Dashboard</h1>
    <div class="status"><span id="dot" class="dot"></span><span id="statusText">Connecting...</span></div>
  </header>
  <nav class="tab-bar" aria-label="Dashboard tabs">
    <button id="analyticsTabButton" class="tab-button active" type="button" data-tab="analytics">Analytics</button>
    <button id="controllerTabButton" class="tab-button" type="button" data-tab="controller">Controller</button>
  </nav>
  <main>
    <section id="analyticsPanel" class="tab-panel analytics-layout">
      <section class="analytics-sidebar">
        <div class="stats">
          <div class="stat"><div class="stat-label">Total Rooms</div><div id="totalRoomCount" class="stat-value">0</div></div>
          <div class="stat"><div class="stat-label">CCU</div><div id="ccuCount" class="stat-value">0</div></div>
        </div>
        <div class="panel rooms-panel">
          <h2>Active Rooms</h2>
          <div id="roomList" class="room-list"></div>
        </div>
      </section>
      <section class="panel detail-panel">
        <h2 id="roomHeading">Select a room</h2>
        <div id="roomMeta" class="muted"></div>
        <div class="grid" style="margin-top:14px">
          <div class="scroll-column">
            <h2>Players</h2>
            <div id="playerList" class="player-list"></div>
          </div>
          <div class="scroll-column">
            <h2>Room Logs</h2>
            <div id="roomLogs" class="log-list"></div>
          </div>
        </div>
      </section>
    </section>
    <section id="controllerPanel" class="tab-panel controller-layout hidden">
      <div class="panel">
        <h2>Timing Controls</h2>
        <div id="timingFields" class="config-grid"></div>
        <div class="config-actions">
          <button id="saveTimingButton" type="button">Save</button>
          <button id="resetTimingButton" type="button">Reset</button>
          <div id="timingStatus" class="config-status"></div>
        </div>
      </div>
      <div class="panel">
        <h2>Dice AI Controls</h2>
        <div id="diceAiFields" class="config-grid"></div>
        <div class="config-actions">
          <button id="saveDiceAiButton" type="button">Save</button>
          <button id="resetDiceAiButton" type="button">Reset</button>
          <div id="diceAiStatus" class="config-status"></div>
        </div>
      </div>
    </section>
  </main>
  <script>
    let adminKey = sessionStorage.getItem("adminKey") || prompt("Dashboard admin key") || "";
    sessionStorage.setItem("adminKey", adminKey);
    const plainFetch = window.fetch.bind(window);
    window.fetch = async (url, options = {}) => {
      const headers = Object.assign({}, options.headers, { Authorization: "Bearer " + adminKey });
      const response = await plainFetch(url, Object.assign({}, options, { headers }));
      if (response.status === 401) {
        sessionStorage.removeItem("adminKey");
        location.reload();
      }
      return response;
    };
    const dot = document.getElementById("dot");
    const statusText = document.getElementById("statusText");
    const analyticsPanel = document.getElementById("analyticsPanel");
    const controllerPanel = document.getElementById("controllerPanel");
    const analyticsTabButton = document.getElementById("analyticsTabButton");
    const controllerTabButton = document.getElementById("controllerTabButton");
    const totalRoomCount = document.getElementById("totalRoomCount");
    const ccuCount = document.getElementById("ccuCount");
    const timingFields = document.getElementById("timingFields");
    const saveTimingButton = document.getElementById("saveTimingButton");
    const resetTimingButton = document.getElementById("resetTimingButton");
    const timingStatus = document.getElementById("timingStatus");
    const diceAiFields = document.getElementById("diceAiFields");
    const saveDiceAiButton = document.getElementById("saveDiceAiButton");
    const resetDiceAiButton = document.getElementById("resetDiceAiButton");
    const diceAiStatus = document.getElementById("diceAiStatus");
    const roomList = document.getElementById("roomList");
    const roomHeading = document.getElementById("roomHeading");
    const roomMeta = document.getElementById("roomMeta");
    const playerList = document.getElementById("playerList");
    const roomLogs = document.getElementById("roomLogs");
    let selectedRoomCode = "";
    let activeTab = "analytics";
    let timingConfigMeta = null;
    let diceAiConfigMeta = null;

    const timingFieldDefinitions = [
      { key: "diceRollDurationSeconds", label: "Dice roll", step: "0.1" },
      { key: "diceAnimationTimeoutSeconds", label: "Dice timeout", step: "0.1" },
      { key: "pawnMoveAnimationTimeoutSeconds", label: "Pawn move timeout", step: "0.1" },
      { key: "pawnDeathAnimationTimeoutSeconds", label: "Pawn death timeout", step: "0.1" },
      { key: "correctionStepDelaySeconds", label: "Correction delay", step: "0.01" },
      { key: "turnTimerSeconds", label: "Turn / bot active", step: "1" },
      { key: "botDiceRollDelaySeconds", label: "Bot dice roll delay", step: "0.1" },
      { key: "botActionDelaySeconds", label: "Bot action delay", step: "0.1" },
      { key: "noMoveTurnEndDelaySeconds", label: "No-move turn end", step: "0.1" },
      { key: "pawnMoveSpeed", label: "Pawn move speed", step: "0.01" }
    ];

    const diceAiFieldDefinitions = [
      { key: "dice1Weight", label: "Dice 1 weight", step: "1", suffix: "" },
      { key: "dice2Weight", label: "Dice 2 weight", step: "1", suffix: "" },
      { key: "dice3Weight", label: "Dice 3 weight", step: "1", suffix: "" },
      { key: "dice4Weight", label: "Dice 4 weight", step: "1", suffix: "" },
      { key: "dice5Weight", label: "Dice 5 weight", step: "1", suffix: "" },
      { key: "dice6Weight", label: "Dice 6 weight", step: "1", suffix: "" },
      { key: "killDiceNumberPercent", label: "Kill dice number", step: "1", suffix: "%" },
      { key: "safePointDiceNumberPercent", label: "Safe point dice", step: "1", suffix: "%" },
      { key: "openPawnDiceNumberPercent", label: "Open pawn dice", step: "1", suffix: "%" },
      { key: "finishPawnDiceNumberPercent", label: "Finish pawn dice", step: "1", suffix: "%" },
      { key: "progressDiceNumberPercent", label: "Progress dice", step: "1", suffix: "%" },
      { key: "combo665Percent", label: "Combo 6,6 -> 5", step: "1", suffix: "%" },
      { key: "combo666Percent", label: "Combo 6,6 -> 6", step: "1", suffix: "%" },
      { key: "repeatPenaltyPercent", label: "Repeat penalty", step: "1", suffix: "%" },
      { key: "thirdSixPenaltyPercent", label: "Third six penalty", step: "1", suffix: "%" },
      { key: "forceSixAfterNoSixMinTurns", label: "Force six min turns", step: "1", suffix: "" },
      { key: "forceSixAfterNoSixMaxTurns", label: "Force six max turns", step: "1", suffix: "" },
      { key: "minDiceWeight", label: "Min dice weight", step: "0.01", suffix: "" },
      { key: "maxDiceWeight", label: "Max dice weight", step: "1", suffix: "" }
    ];

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character]));
    }

    function setActiveTab(tabName) {
      activeTab = tabName === "controller" ? "controller" : "analytics";
      const isController = activeTab === "controller";
      analyticsPanel.classList.toggle("hidden", isController);
      controllerPanel.classList.toggle("hidden", !isController);
      analyticsTabButton.classList.toggle("active", !isController);
      controllerTabButton.classList.toggle("active", isController);
      if (isController) {
        loadTimingConfig();
        loadDiceAiConfig();
      }
    }

    function statusBadge(status) {
      return '<span class="badge ' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>';
    }

    function replaceHtmlPreserveScroll(element, html) {
      const scrollTop = element.scrollTop;
      const wasNearBottom = element.scrollHeight - element.clientHeight - element.scrollTop < 24;
      element.innerHTML = html;
      if (wasNearBottom) {
        element.scrollTop = element.scrollHeight;
      } else {
        element.scrollTop = scrollTop;
      }
    }

    async function loadTimingConfig() {
      try {
        timingConfigMeta = await fetch("/config/timing").then((response) => response.json());
        renderTimingConfig(timingConfigMeta.config || {});
        timingStatus.textContent = "Defaults for new rooms";
      } catch (error) {
        timingStatus.textContent = "Timing config unavailable";
      }
    }

    function renderTimingConfig(config) {
      timingFields.innerHTML = timingFieldDefinitions.map((field) => {
        const limits = timingConfigMeta && timingConfigMeta.limits ? timingConfigMeta.limits[field.key] : null;
        const min = limits ? limits.min : 0;
        const max = limits ? limits.max : 999;
        const value = config[field.key] != null ? config[field.key] : "";
        return '<div class="config-field">' +
          '<label for="timing-' + escapeHtml(field.key) + '">' + escapeHtml(field.label) + ' (sec)</label>' +
          '<input id="timing-' + escapeHtml(field.key) + '" data-timing-key="' + escapeHtml(field.key) + '" type="number" inputmode="decimal" min="' + escapeHtml(min) + '" max="' + escapeHtml(max) + '" step="' + escapeHtml(field.step) + '" value="' + escapeHtml(value) + '">' +
        '</div>';
      }).join("");
    }

    async function loadDiceAiConfig() {
      try {
        diceAiConfigMeta = await fetch("/config/dice-ai").then((response) => response.json());
        renderDiceAiConfig(diceAiConfigMeta.config || {});
        diceAiStatus.textContent = "Applies next roll";
      } catch (error) {
        diceAiStatus.textContent = "Dice AI config unavailable";
      }
    }

    function renderDiceAiConfig(config) {
      diceAiFields.innerHTML = diceAiFieldDefinitions.map((field) => {
        const limits = diceAiConfigMeta && diceAiConfigMeta.limits ? diceAiConfigMeta.limits[field.key] : null;
        const min = limits ? limits.min : 0;
        const max = limits ? limits.max : 999;
        const value = config[field.key] != null ? config[field.key] : "";
        const suffix = field.suffix ? " (" + field.suffix + ")" : "";
        return '<div class="config-field">' +
          '<label for="dice-ai-' + escapeHtml(field.key) + '">' + escapeHtml(field.label) + escapeHtml(suffix) + '</label>' +
          '<input id="dice-ai-' + escapeHtml(field.key) + '" data-dice-ai-key="' + escapeHtml(field.key) + '" type="number" inputmode="decimal" min="' + escapeHtml(min) + '" max="' + escapeHtml(max) + '" step="' + escapeHtml(field.step) + '" value="' + escapeHtml(value) + '">' +
        '</div>';
      }).join("");
    }

    function readTimingForm() {
      const payload = {};
      for (const input of timingFields.querySelectorAll("input[data-timing-key]")) {
        payload[input.dataset.timingKey] = Number(input.value);
      }

      return payload;
    }

    function readDiceAiForm() {
      const payload = {};
      for (const input of diceAiFields.querySelectorAll("input[data-dice-ai-key]")) {
        payload[input.dataset.diceAiKey] = Number(input.value);
      }

      return payload;
    }

    async function saveTimingConfig(payload) {
      saveTimingButton.disabled = true;
      resetTimingButton.disabled = true;
      timingStatus.textContent = "Saving...";
      try {
        const response = await fetch("/config/timing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error("Save failed");
        }

        timingConfigMeta = await response.json();
        renderTimingConfig(timingConfigMeta.config || {});
        timingStatus.textContent = "Saved for new rooms";
      } catch (error) {
        timingStatus.textContent = "Save failed";
      } finally {
        saveTimingButton.disabled = false;
        resetTimingButton.disabled = false;
      }
    }

    async function saveDiceAiConfig(payload) {
      saveDiceAiButton.disabled = true;
      resetDiceAiButton.disabled = true;
      diceAiStatus.textContent = "Saving...";
      try {
        const response = await fetch("/config/dice-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error("Save failed");
        }

        diceAiConfigMeta = await response.json();
        renderDiceAiConfig(diceAiConfigMeta.config || {});
        diceAiStatus.textContent = "Saved for next roll";
      } catch (error) {
        diceAiStatus.textContent = "Save failed";
      } finally {
        saveDiceAiButton.disabled = false;
        resetDiceAiButton.disabled = false;
      }
    }

    async function refreshDashboard() {
      const stats = await fetch("/stats").then((response) => response.json());
      const rooms = await fetch("/rooms").then((response) => response.json());
      totalRoomCount.textContent = String(stats.totalRoomCount || 0);
      ccuCount.textContent = String(stats.ccu || 0);
      renderRooms(rooms);

      if (selectedRoomCode) {
        await loadRoom(selectedRoomCode, false);
      } else if (rooms.length > 0) {
        await loadRoom(rooms[0].roomCode, true);
      }
    }

    function renderRooms(rooms) {
      if (rooms.length === 0) {
        replaceHtmlPreserveScroll(roomList, '<div class="empty">No active rooms</div>');
        return;
      }

      replaceHtmlPreserveScroll(roomList, rooms.map((room) => {
        const active = room.roomCode === selectedRoomCode ? " active" : "";
        return '<button class="room-button' + active + '" type="button" data-room-code="' + escapeHtml(room.roomCode) + '">' +
          '<div class="room-title"><span>' + escapeHtml(room.roomCode) + '</span>' + statusBadge(room.status) + '</div>' +
          '<div class="muted">' + escapeHtml(room.connectedPlayerCount) + ' CCU, ' + escapeHtml(room.playerCount) + ' / ' + escapeHtml(room.expectedPlayerCount) + ' players</div>' +
          '<div class="muted">Updated ' + escapeHtml(new Date(room.updatedAt).toLocaleTimeString()) + '</div>' +
        '</button>';
      }).join(""));

      for (const button of roomList.querySelectorAll("button[data-room-code]")) {
        button.addEventListener("click", () => loadRoom(button.dataset.roomCode, true));
      }
    }

    async function loadRoom(roomCode, updateSelection) {
      if (updateSelection) selectedRoomCode = roomCode;
      const stateResponse = await fetch("/rooms/" + encodeURIComponent(roomCode) + "/state");
      if (!stateResponse.ok) {
        replaceHtmlPreserveScroll(playerList, '<div class="empty">Room state unavailable</div>');
        replaceHtmlPreserveScroll(roomLogs, "");
        return;
      }

      const state = await stateResponse.json();
      const logs = await fetch("/rooms/" + encodeURIComponent(roomCode) + "/logs").then((response) => response.json());
      renderRoomState(state);
      renderRoomLogs(logs);
      for (const button of roomList.querySelectorAll("button[data-room-code]")) {
        button.classList.toggle("active", button.dataset.roomCode === selectedRoomCode);
      }
    }

    function renderRoomState(state) {
      roomHeading.textContent = "Room " + state.roomCode;
      roomMeta.textContent = state.connectedPlayerCount + " CCU, " + state.playerCount + " / " + state.expectedPlayerCount + " players, current turn: " + (state.currentPlayerId || "none");
      const players = state.players || [];
      if (players.length === 0) {
        replaceHtmlPreserveScroll(playerList, '<div class="empty">No players joined</div>');
        return;
      }

      replaceHtmlPreserveScroll(playerList, players.map((player) => {
        const profile = player.profile || {};
        const status = player.connected ? "connected" : "disconnected";
        return '<div class="player">' +
          '<div class="player-head"><div class="player-id">' + escapeHtml(player.playerId) + '</div><span class="badge ' + status + '">' + status + '</span></div>' +
          '<div class="muted">Name: ' + escapeHtml(profile.playerName || "Unknown") + '</div>' +
          '<div class="muted">Slot: ' + escapeHtml(player.slotIndex) + ', Start: ' + escapeHtml(player.startIndex) + ', Bot: ' + escapeHtml(player.isBot ? "yes" : "no") + '</div>' +
          '<div class="muted">Pawns: ' + escapeHtml(player.pawnCount) + ', Base: ' + escapeHtml(player.pawnsInBase) + ', Home: ' + escapeHtml(player.pawnsHome) + '</div>' +
          '<div class="muted">Client: ' + escapeHtml(player.clientKey || "") + '</div>' +
        '</div>';
      }).join(""));
    }

    function renderRoomLogs(logs) {
      if (logs.length === 0) {
        replaceHtmlPreserveScroll(roomLogs, '<div class="empty">No room logs yet</div>');
        return;
      }

      replaceHtmlPreserveScroll(roomLogs, logs.slice(-80).reverse().map((entry) => (
        '<div class="log-entry">' +
          '<div><span class="log-event">' + escapeHtml(entry.eventName) + '</span> <span class="muted">' + escapeHtml(new Date(entry.timestamp).toLocaleTimeString()) + '</span></div>' +
          '<div class="muted">' + escapeHtml(entry.source) + '</div>' +
          '<div class="log-details">' + escapeHtml(JSON.stringify(entry.details || {}, null, 2)) + '</div>' +
        '</div>'
      )).join(""));
    }

    // EventSource cannot send headers, so /events takes the key as a query param.
    const events = new EventSource("/events?key=" + encodeURIComponent(adminKey));
    events.onopen = () => {
      dot.classList.add("connected");
      statusText.textContent = "Live";
    };
    events.onerror = () => {
      dot.classList.remove("connected");
      statusText.textContent = "Reconnecting...";
    };
    events.onmessage = () => refreshDashboard();
    analyticsTabButton.addEventListener("click", () => setActiveTab("analytics"));
    controllerTabButton.addEventListener("click", () => setActiveTab("controller"));
    saveTimingButton.addEventListener("click", () => saveTimingConfig(readTimingForm()));
    resetTimingButton.addEventListener("click", () => saveTimingConfig({ reset: true }));
    saveDiceAiButton.addEventListener("click", () => saveDiceAiConfig(readDiceAiForm()));
    resetDiceAiButton.addEventListener("click", () => saveDiceAiConfig({ reset: true }));
    loadTimingConfig();
    loadDiceAiConfig();
    setActiveTab("analytics");
    refreshDashboard();
    setInterval(refreshDashboard, 3000);
  </script>
</body>
</html>`;
}
