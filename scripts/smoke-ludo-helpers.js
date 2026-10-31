const assert = require("node:assert/strict");
const { isValidChatMessage, normalizeChatMessage } = require("../dist/rooms/ludoChat");
const {
  ServerDiceAi,
  buildDiceWeights,
  createDiceAiMemory,
  ensureForceSixTarget,
  pickWeightedDice,
  recordDiceResult,
  shouldForceSix
} = require("../dist/rooms/ludoDiceAi");
const {
  getDefaultDiceAiConfig,
  getDiceAiConfig,
  resetDiceAiConfig,
  updateDiceAiConfig
} = require("../dist/serverDiceAiConfig");
const {
  chooseLudoBotPawn,
  scoreLudoBotPawn
} = require("../dist/rooms/ludoBotAi");
const {
  areAllPawnsHome,
  chooseBotPawn,
  createPawns,
  findCapturedPawn,
  getBoardIndex,
  getLegalPawnIds
} = require("../dist/rooms/ludoRules");
const { secondsToTimerMs } = require("../dist/rooms/ludoTimers");
const { resolveTurnReplay } = require("../dist/rooms/ludoTurnBonus");

function createTestPlayer(playerId, startIndex) {
  return {
    clientKey: playerId,
    sessionId: `session-${playerId}`,
    playerId,
    slotIndex: startIndex,
    startIndex,
    pawns: createPawns(playerId, 4),
    connected: true,
    isBot: false,
    turnTimeoutHandle: null,
    botActionHandle: null
  };
}

function createDiceContext(player, players = [player], consecutiveSixCount = 0) {
  return {
    players,
    player,
    totalMoveCount: 56,
    commonPathCount: 51,
    commonTrackCount: 52,
    safePointIndexes: new Set(),
    consecutiveSixCount
  };
}

function createBotContext(player, players, activePawnIds, diceNumber, safePointIndexes = new Set()) {
  return {
    players,
    player,
    activePawnIds,
    diceNumber,
    totalMoveCount: 56,
    commonPathCount: 51,
    commonTrackCount: 52,
    safePointIndexes
  };
}

function getWeight(weights, dice) {
  return weights.find((entry) => entry.dice === dice).weight;
}

function assertNear(actual, expected) {
  assert.equal(Math.abs(actual - expected) < 0.0001, true);
}

function randomForDiceSegment(weights, dice) {
  const totalWeight = weights.reduce((total, entry) => total + entry.weight, 0);
  let lowerBound = 0;
  for (const entry of weights) {
    const upperBound = lowerBound + entry.weight;
    if (entry.dice === dice) {
      return (lowerBound + entry.weight / 2) / totalWeight;
    }

    lowerBound = upperBound;
  }

  throw new Error(`Dice segment missing: ${dice}`);
}

const playerA = {
  clientKey: "a",
  sessionId: "sa",
  playerId: "player-a",
  slotIndex: 0,
  startIndex: 0,
  pawns: createPawns("player-a", 4),
  connected: true,
  isBot: false,
  turnTimeoutHandle: null,
  botActionHandle: null
};

const playerB = {
  clientKey: "b",
  sessionId: "sb",
  playerId: "player-b",
  slotIndex: 1,
  startIndex: 13,
  pawns: createPawns("player-b", 4),
  connected: true,
  isBot: false,
  turnTimeoutHandle: null,
  botActionHandle: null
};

assert.deepEqual(normalizeChatMessage({ playerId: "p1", messageType: " Text ", data: " hello " }), {
  requestedPlayerId: "p1",
  messageType: "text",
  data: "hello"
});
assert.equal(isValidChatMessage("emoji", "0"), true);
assert.equal(isValidChatMessage("emoji", "101"), false);
assert.equal(isValidChatMessage("text", "hello"), true);
assert.equal(isValidChatMessage("text", ""), false);

assert.deepEqual(resolveTurnReplay(0, true, 0), {
  playAgain: true,
  queuedBonusTurns: 0,
  replayReason: "six"
});
assert.deepEqual(resolveTurnReplay(0, false, 1), {
  playAgain: true,
  queuedBonusTurns: 0,
  replayReason: "queued_bonus"
});
assert.deepEqual(resolveTurnReplay(0, true, 1), {
  playAgain: true,
  queuedBonusTurns: 1,
  replayReason: "six"
});
const stackedBonusReplay = resolveTurnReplay(1, false, 0);
assert.deepEqual(stackedBonusReplay, {
  playAgain: true,
  queuedBonusTurns: 0,
  replayReason: "queued_bonus"
});
assert.deepEqual(resolveTurnReplay(stackedBonusReplay.queuedBonusTurns, false, 0), {
  playAgain: false,
  queuedBonusTurns: 0,
  replayReason: "none"
});
assert.deepEqual(resolveTurnReplay(1, false, 0, true), {
  playAgain: false,
  queuedBonusTurns: 0,
  replayReason: "forced_advance"
});
assert.deepEqual(resolveTurnReplay(0, false, 0), {
  playAgain: false,
  queuedBonusTurns: 0,
  replayReason: "none"
});

assert.equal(playerA.pawns.length, 4);
assert.deepEqual(getLegalPawnIds(playerA, 1, 56), []);
assert.deepEqual(getLegalPawnIds(playerA, 6, 56), playerA.pawns.map((pawn) => pawn.pawnId));

playerA.pawns[0].position = 0;
playerB.pawns[0].position = 39;
assert.equal(getBoardIndex(playerA, playerA.pawns[0], 51, 52), 0);
assert.equal(getBoardIndex(playerB, playerB.pawns[0], 51, 52), 0);
assert.equal(findCapturedPawn([playerA, playerB], playerA, playerA.pawns[0], new Set(), 51, 52), playerB.pawns[0]);

playerA.pawns[1].position = 50;
assert.equal(chooseBotPawn([playerA, playerB], playerA, [playerA.pawns[1].pawnId], 6, 56, 51, 52, new Set()), playerA.pawns[1]);
assert.equal(secondsToTimerMs(0), 1);
assert.equal(secondsToTimerMs(1.25), 1250);

const finalHomePlayer = createTestPlayer("final-home-player", 0);
finalHomePlayer.pawns.forEach((pawn) => {
  pawn.position = 56;
  pawn.isHome = true;
});
assert.equal(areAllPawnsHome(finalHomePlayer), true);
finalHomePlayer.pawns[0].isHome = false;
assert.equal(areAllPawnsHome(finalHomePlayer), false);

const emptyBotPlayer = createTestPlayer("empty-bot", 0);
assert.equal(chooseLudoBotPawn(createBotContext(emptyBotPlayer, [emptyBotPlayer], [], 6)), null);

const openBotPlayer = createTestPlayer("open-bot", 0);
openBotPlayer.pawns[1].position = 20;
assert.equal(
  chooseLudoBotPawn(createBotContext(
    openBotPlayer,
    [openBotPlayer],
    [openBotPlayer.pawns[0].pawnId, openBotPlayer.pawns[1].pawnId],
    6
  )),
  openBotPlayer.pawns[0]
);

const killBotPlayer = createTestPlayer("kill-bot", 0);
const killBotOpponent = createTestPlayer("kill-bot-opponent", 13);
killBotPlayer.pawns[0].position = 0;
killBotPlayer.pawns[1].position = 20;
killBotOpponent.pawns[0].position = 42;
assert.equal(
  chooseLudoBotPawn(createBotContext(
    killBotPlayer,
    [killBotPlayer, killBotOpponent],
    [killBotPlayer.pawns[0].pawnId, killBotPlayer.pawns[1].pawnId],
    3
  )),
  killBotPlayer.pawns[0]
);

const finishBotPlayer = createTestPlayer("finish-bot", 0);
finishBotPlayer.pawns[0].position = 54;
finishBotPlayer.pawns[1].position = 20;
assert.equal(
  chooseLudoBotPawn(createBotContext(
    finishBotPlayer,
    [finishBotPlayer],
    [finishBotPlayer.pawns[0].pawnId, finishBotPlayer.pawns[1].pawnId],
    2
  )),
  finishBotPlayer.pawns[0]
);

const safeBotPlayer = createTestPlayer("safe-bot", 0);
safeBotPlayer.pawns[0].position = 7;
safeBotPlayer.pawns[1].position = 20;
assert.equal(
  chooseLudoBotPawn(createBotContext(
    safeBotPlayer,
    [safeBotPlayer],
    [safeBotPlayer.pawns[0].pawnId, safeBotPlayer.pawns[1].pawnId],
    1,
    new Set([8])
  )),
  safeBotPlayer.pawns[0]
);

const blockBotPlayer = createTestPlayer("block-bot", 0);
blockBotPlayer.pawns[0].position = 0;
blockBotPlayer.pawns[1].position = 3;
blockBotPlayer.pawns[2].position = 20;
assert.equal(
  chooseLudoBotPawn(createBotContext(
    blockBotPlayer,
    [blockBotPlayer],
    [blockBotPlayer.pawns[0].pawnId, blockBotPlayer.pawns[2].pawnId],
    3
  )),
  blockBotPlayer.pawns[0]
);

const nearbyBotPlayer = createTestPlayer("nearby-bot", 0);
const nearbyOpponent = createTestPlayer("nearby-opponent", 0);
nearbyBotPlayer.pawns[0].position = 8;
nearbyBotPlayer.pawns[1].position = 9;
nearbyOpponent.pawns[0].position = 12;
nearbyOpponent.pawns[1].position = 10;
const nearbyContext = createBotContext(
  nearbyBotPlayer,
  [nearbyBotPlayer, nearbyOpponent],
  [nearbyBotPlayer.pawns[0].pawnId, nearbyBotPlayer.pawns[1].pawnId],
  2
);
assert.equal(chooseLudoBotPawn(nearbyContext), nearbyBotPlayer.pawns[0]);
assert.equal(
  scoreLudoBotPawn(nearbyContext, nearbyBotPlayer.pawns[0]).score >
    scoreLudoBotPawn(nearbyContext, nearbyBotPlayer.pawns[1]).score,
  true
);

const tieBotPlayer = createTestPlayer("tie-bot", 0);
tieBotPlayer.pawns[0].position = 10;
tieBotPlayer.pawns[1].position = 10;
assert.equal(
  chooseLudoBotPawn(createBotContext(
    tieBotPlayer,
    [tieBotPlayer],
    [tieBotPlayer.pawns[1].pawnId, tieBotPlayer.pawns[0].pawnId],
    1
  )),
  tieBotPlayer.pawns[1]
);

resetDiceAiConfig();
const defaultDiceConfig = getDefaultDiceAiConfig();
assert.equal(defaultDiceConfig.dice1Weight, 50);
assert.equal(defaultDiceConfig.dice2Weight, 50);
assert.equal(defaultDiceConfig.dice3Weight, 50);
assert.equal(defaultDiceConfig.dice4Weight, 50);
assert.equal(defaultDiceConfig.dice5Weight, 60);
assert.equal(defaultDiceConfig.dice6Weight, 20);
assert.equal(defaultDiceConfig.killDiceNumberPercent, 50);
assert.equal(defaultDiceConfig.forceSixAfterNoSixMinTurns, 3);
assert.equal(defaultDiceConfig.forceSixAfterNoSixMaxTurns, 4);

const clampedDiceConfig = updateDiceAiConfig({
  dice1Weight: -10,
  killDiceNumberPercent: 999,
  repeatPenaltyPercent: 999,
  forceSixAfterNoSixMinTurns: -5,
  forceSixAfterNoSixMaxTurns: 99,
  minDiceWeight: 250,
  maxDiceWeight: 5
});
assert.equal(clampedDiceConfig.dice1Weight, 1);
assert.equal(clampedDiceConfig.killDiceNumberPercent, 500);
assert.equal(clampedDiceConfig.repeatPenaltyPercent, 95);
assert.equal(clampedDiceConfig.forceSixAfterNoSixMinTurns, 1);
assert.equal(clampedDiceConfig.forceSixAfterNoSixMaxTurns, 20);
assert.equal(clampedDiceConfig.minDiceWeight, 250);
assert.equal(clampedDiceConfig.maxDiceWeight, 250);
const orderedForceSixConfig = updateDiceAiConfig({
  forceSixAfterNoSixMinTurns: 8,
  forceSixAfterNoSixMaxTurns: 3
});
assert.equal(orderedForceSixConfig.forceSixAfterNoSixMinTurns, 8);
assert.equal(orderedForceSixConfig.forceSixAfterNoSixMaxTurns, 8);
resetDiceAiConfig();
assert.deepEqual(getDiceAiConfig(), defaultDiceConfig);

const diceAi = new ServerDiceAi();
const rangePlayer = createTestPlayer("range-player", 0);
rangePlayer.pawns[0].position = 0;
for (let index = 0; index < 24; index++) {
  const diceNumber = diceAi.roll(createDiceContext(rangePlayer), () => (index % 6) / 6);
  assert.equal(Number.isInteger(diceNumber), true);
  assert.equal(diceNumber >= 1 && diceNumber <= 6, true);
}

const isolatedAi = new ServerDiceAi();
isolatedAi.roll(createDiceContext(createTestPlayer("isolated-a", 0)), () => 0);
assert.equal(isolatedAi.getMemory("isolated-a").history.length, 1);
assert.equal(isolatedAi.getMemory("isolated-b").history.length, 0);

const repeatPlayer = createTestPlayer("repeat-player", 0);
repeatPlayer.pawns[0].position = 0;
const repeatMemory = createDiceAiMemory();
repeatMemory.history.push(4);
const repeatWeights = buildDiceWeights(createDiceContext(repeatPlayer), repeatMemory);
assert.equal(getWeight(repeatWeights, 4) < getWeight(repeatWeights, 3), true);

const sixPenaltyWeights = buildDiceWeights(createDiceContext(repeatPlayer, [repeatPlayer], 2), createDiceAiMemory());
assert.equal(getWeight(sixPenaltyWeights, 6) < getWeight(sixPenaltyWeights, 5), true);

const lockedPlayer = createTestPlayer("locked-player", 0);
const lockedWeights = buildDiceWeights(createDiceContext(lockedPlayer), createDiceAiMemory());
for (const dice of [1, 2, 3, 4, 5, 6]) {
  assert.equal(getWeight(lockedWeights, dice) > 0, true);
  assert.equal(pickWeightedDice(lockedWeights, () => randomForDiceSegment(lockedWeights, dice)), dice);
}
const openOnlyWeights = buildDiceWeights(createDiceContext(lockedPlayer), createDiceAiMemory(), {
  ...defaultDiceConfig,
  dice1Weight: 50,
  dice2Weight: 50,
  dice3Weight: 50,
  dice4Weight: 50,
  dice5Weight: 50,
  dice6Weight: 50,
  killDiceNumberPercent: 0,
  safePointDiceNumberPercent: 0,
  openPawnDiceNumberPercent: 30,
  finishPawnDiceNumberPercent: 0,
  progressDiceNumberPercent: 0,
  combo665Percent: 0,
  combo666Percent: 0,
  repeatPenaltyPercent: 0,
  thirdSixPenaltyPercent: 0,
  minDiceWeight: 1,
  maxDiceWeight: 500
});
assertNear(getWeight(openOnlyWeights, 6), 65);
assertNear(getWeight(openOnlyWeights, 1), 45);

const noMoveMemory = createDiceAiMemory();
noMoveMemory.noMoveStreak = 2;
const noMoveWeights = buildDiceWeights(createDiceContext(lockedPlayer), noMoveMemory);
assert.equal(getWeight(noMoveWeights, 6) > getWeight(lockedWeights, 6), true);

const capturePlayer = createTestPlayer("capture-player", 0);
const captureOpponent = createTestPlayer("capture-opponent", 13);
capturePlayer.pawns[0].position = 0;
captureOpponent.pawns[0].position = 42;
const captureWeights = buildDiceWeights(createDiceContext(capturePlayer, [capturePlayer, captureOpponent]), createDiceAiMemory());
assert.equal(getWeight(captureWeights, 3) > getWeight(captureWeights, 2), true);
const killOnlyConfig = {
  ...defaultDiceConfig,
  dice1Weight: 50,
  dice2Weight: 50,
  dice3Weight: 50,
  dice4Weight: 50,
  dice5Weight: 50,
  dice6Weight: 50,
  killDiceNumberPercent: 50,
  safePointDiceNumberPercent: 0,
  openPawnDiceNumberPercent: 0,
  finishPawnDiceNumberPercent: 0,
  progressDiceNumberPercent: 0,
  combo665Percent: 0,
  combo666Percent: 0,
  repeatPenaltyPercent: 0,
  thirdSixPenaltyPercent: 0,
  minDiceWeight: 1,
  maxDiceWeight: 500
};
const killOnlyWeights = buildDiceWeights(
  createDiceContext(capturePlayer, [capturePlayer, captureOpponent]),
  createDiceAiMemory(),
  killOnlyConfig
);
assertNear(getWeight(killOnlyWeights, 3), 75);
assertNear(getWeight(killOnlyWeights, 2), 50);

const finishPlayer = createTestPlayer("finish-player", 0);
finishPlayer.pawns[0].position = 54;
const finishWeights = buildDiceWeights(createDiceContext(finishPlayer), createDiceAiMemory());
assert.equal(getWeight(finishWeights, 2) > getWeight(finishWeights, 1), true);

const comboMemory = createDiceAiMemory();
comboMemory.history.push(6, 6);
const comboWeights = buildDiceWeights(createDiceContext(repeatPlayer), comboMemory, {
  ...killOnlyConfig,
  combo665Percent: 30,
  combo666Percent: 10
});
assertNear(getWeight(comboWeights, 5), 65);
assertNear(getWeight(comboWeights, 6), 55);

const recordMemory = createDiceAiMemory();
recordDiceResult(recordMemory, createDiceContext(lockedPlayer), 1);
assert.equal(recordMemory.noMoveStreak, 1);
assert.equal(recordMemory.rollsSinceSix, 1);
recordDiceResult(recordMemory, createDiceContext(lockedPlayer), 6);
assert.equal(recordMemory.noMoveStreak, 0);
assert.equal(recordMemory.rollsSinceSix, 0);

const forceRangeMemory = createDiceAiMemory();
ensureForceSixTarget(forceRangeMemory, {
  ...defaultDiceConfig,
  forceSixAfterNoSixMinTurns: 3,
  forceSixAfterNoSixMaxTurns: 4
}, () => 0.99);
assert.equal(forceRangeMemory.forceSixTargetTurns, 4);
ensureForceSixTarget(forceRangeMemory, {
  ...defaultDiceConfig,
  forceSixAfterNoSixMinTurns: 3,
  forceSixAfterNoSixMaxTurns: 3
}, () => 0.99);
assert.equal(forceRangeMemory.forceSixTargetTurns, 3);

const forceAi = new ServerDiceAi();
const forcePlayer = createTestPlayer("force-player", 0);
const forceMemory = forceAi.getMemory("force-player");
forceMemory.rollsSinceSix = 3;
forceMemory.forceSixTargetTurns = 3;
assert.equal(shouldForceSix(forceMemory, createDiceContext(forcePlayer)), true);
assert.equal(forceAi.roll(createDiceContext(forcePlayer), () => 0), 6);
assert.equal(forceMemory.rollsSinceSix, 0);
assert.equal(forceMemory.forceSixTargetTurns >= 3 && forceMemory.forceSixTargetTurns <= 4, true);

const skipForceMemory = createDiceAiMemory();
skipForceMemory.rollsSinceSix = 4;
skipForceMemory.forceSixTargetTurns = 3;
assert.equal(shouldForceSix(skipForceMemory, createDiceContext(forcePlayer, [forcePlayer], 2)), false);

console.log("ludo helper smoke checks passed");
