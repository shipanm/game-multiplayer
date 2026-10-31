export interface MultiplayerAnimationConfigMessage {
  diceRollDurationSeconds: number;
  diceAnimationTimeoutSeconds: number;
  pawnMoveAnimationTimeoutSeconds: number;
  pawnDeathAnimationTimeoutSeconds: number;
  correctionStepDelaySeconds: number;
  turnTimerSeconds: number;
  botDiceRollDelaySeconds: number;
  botActionDelaySeconds: number;
  noMoveTurnEndDelaySeconds: number;
  pawnMoveSpeed: number;
}

type TimingConfigKey = keyof MultiplayerAnimationConfigMessage;

type TimingConfigLimits = Record<TimingConfigKey, { min: number; max: number }>;

const DEFAULT_TIMING_CONFIG: MultiplayerAnimationConfigMessage = {
  diceRollDurationSeconds: 3,
  diceAnimationTimeoutSeconds: 4,
  pawnMoveAnimationTimeoutSeconds: 4,
  pawnDeathAnimationTimeoutSeconds: 6,
  correctionStepDelaySeconds: 0.05,
  turnTimerSeconds: 30,
  botDiceRollDelaySeconds: 2.5,
  botActionDelaySeconds: 2,
  noMoveTurnEndDelaySeconds: 1,
  pawnMoveSpeed: 1
};

const TIMING_CONFIG_LIMITS: TimingConfigLimits = {
  diceRollDurationSeconds: { min: 0.1, max: 30 },
  diceAnimationTimeoutSeconds: { min: 0.1, max: 60 },
  pawnMoveAnimationTimeoutSeconds: { min: 0.1, max: 60 },
  pawnDeathAnimationTimeoutSeconds: { min: 0.1, max: 120 },
  correctionStepDelaySeconds: { min: 0, max: 5 },
  turnTimerSeconds: { min: 1, max: 300 },
  botDiceRollDelaySeconds: { min: 0.1, max: 60 },
  botActionDelaySeconds: { min: 0.1, max: 60 },
  noMoveTurnEndDelaySeconds: { min: 0.1, max: 60 },
  pawnMoveSpeed: { min: 0.01, max: 10 }
};

let timingConfig: MultiplayerAnimationConfigMessage = { ...DEFAULT_TIMING_CONFIG };

export function getTimingConfig(): MultiplayerAnimationConfigMessage {
  return { ...timingConfig };
}

export function getDefaultTimingConfig(): MultiplayerAnimationConfigMessage {
  return { ...DEFAULT_TIMING_CONFIG };
}

export function getTimingConfigLimits(): TimingConfigLimits {
  return { ...TIMING_CONFIG_LIMITS };
}

export function resetTimingConfig(): MultiplayerAnimationConfigMessage {
  timingConfig = { ...DEFAULT_TIMING_CONFIG };
  return getTimingConfig();
}

export function updateTimingConfig(input: unknown): MultiplayerAnimationConfigMessage {
  if (input == null || typeof input !== "object") {
    return getTimingConfig();
  }

  const nextConfig = { ...timingConfig };
  for (const key of Object.keys(DEFAULT_TIMING_CONFIG) as TimingConfigKey[]) {
    const value = Number((input as Partial<Record<TimingConfigKey, unknown>>)[key]);
    if (!Number.isFinite(value)) {
      continue;
    }

    const limits = TIMING_CONFIG_LIMITS[key];
    nextConfig[key] = Math.max(limits.min, Math.min(limits.max, value));
  }

  timingConfig = nextConfig;
  return getTimingConfig();
}
