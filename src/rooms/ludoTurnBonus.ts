export interface TurnReplayResolution {
  playAgain: boolean;
  queuedBonusTurns: number;
  replayReason: "six" | "queued_bonus" | "none" | "forced_advance";
}

export function resolveTurnReplay(
  currentQueuedBonusTurns: number,
  rolledSix: boolean,
  earnedBonusTurns: number,
  forceAdvance = false
): TurnReplayResolution {
  if (forceAdvance) {
    return {
      playAgain: false,
      queuedBonusTurns: 0,
      replayReason: "forced_advance"
    };
  }

  const queuedBonusTurns = Math.max(0, currentQueuedBonusTurns) + Math.max(0, earnedBonusTurns);
  if (rolledSix) {
    return {
      playAgain: true,
      queuedBonusTurns,
      replayReason: "six"
    };
  }

  if (queuedBonusTurns > 0) {
    return {
      playAgain: true,
      queuedBonusTurns: queuedBonusTurns - 1,
      replayReason: "queued_bonus"
    };
  }

  return {
    playAgain: false,
    queuedBonusTurns: 0,
    replayReason: "none"
  };
}
