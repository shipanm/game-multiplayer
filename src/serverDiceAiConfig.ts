export interface ServerDiceAiConfig {
  dice1Weight: number;
  dice2Weight: number;
  dice3Weight: number;
  dice4Weight: number;
  dice5Weight: number;
  dice6Weight: number;
  killDiceNumberPercent: number;
  safePointDiceNumberPercent: number;
  openPawnDiceNumberPercent: number;
  finishPawnDiceNumberPercent: number;
  progressDiceNumberPercent: number;
  combo665Percent: number;
  combo666Percent: number;
  repeatPenaltyPercent: number;
  thirdSixPenaltyPercent: number;
  forceSixAfterNoSixMinTurns: number;
  forceSixAfterNoSixMaxTurns: number;
  minDiceWeight: number;
  maxDiceWeight: number;
}

type DiceAiConfigKey = keyof ServerDiceAiConfig;

type DiceAiConfigLimits = Record<DiceAiConfigKey, { min: number; max: number }>;

const DEFAULT_DICE_AI_CONFIG: ServerDiceAiConfig = {
  dice1Weight: 50,
  dice2Weight: 50,
  dice3Weight: 50,
  dice4Weight: 50,
  dice5Weight: 60,
  dice6Weight: 20,
  killDiceNumberPercent: 50,
  safePointDiceNumberPercent: 25,
  openPawnDiceNumberPercent: 30,
  finishPawnDiceNumberPercent: 35,
  progressDiceNumberPercent: 12,
  combo665Percent: 30,
  combo666Percent: 10,
  repeatPenaltyPercent: 28,
  thirdSixPenaltyPercent: 80,
  forceSixAfterNoSixMinTurns: 3,
  forceSixAfterNoSixMaxTurns: 4,
  minDiceWeight: 1,
  maxDiceWeight: 200
};

const DICE_AI_CONFIG_LIMITS: DiceAiConfigLimits = {
  dice1Weight: { min: 1, max: 500 },
  dice2Weight: { min: 1, max: 500 },
  dice3Weight: { min: 1, max: 500 },
  dice4Weight: { min: 1, max: 500 },
  dice5Weight: { min: 1, max: 500 },
  dice6Weight: { min: 1, max: 500 },
  killDiceNumberPercent: { min: 0, max: 500 },
  safePointDiceNumberPercent: { min: 0, max: 500 },
  openPawnDiceNumberPercent: { min: 0, max: 500 },
  finishPawnDiceNumberPercent: { min: 0, max: 500 },
  progressDiceNumberPercent: { min: 0, max: 500 },
  combo665Percent: { min: 0, max: 500 },
  combo666Percent: { min: 0, max: 500 },
  repeatPenaltyPercent: { min: 0, max: 95 },
  thirdSixPenaltyPercent: { min: 0, max: 95 },
  forceSixAfterNoSixMinTurns: { min: 1, max: 20 },
  forceSixAfterNoSixMaxTurns: { min: 1, max: 20 },
  minDiceWeight: { min: 0.01, max: 500 },
  maxDiceWeight: { min: 1, max: 1000 }
};

let diceAiConfig: ServerDiceAiConfig = { ...DEFAULT_DICE_AI_CONFIG };

export function getDiceAiConfig(): ServerDiceAiConfig {
  return { ...diceAiConfig };
}

export function getDefaultDiceAiConfig(): ServerDiceAiConfig {
  return { ...DEFAULT_DICE_AI_CONFIG };
}

export function getDiceAiConfigLimits(): DiceAiConfigLimits {
  return { ...DICE_AI_CONFIG_LIMITS };
}

export function resetDiceAiConfig(): ServerDiceAiConfig {
  diceAiConfig = { ...DEFAULT_DICE_AI_CONFIG };
  return getDiceAiConfig();
}

export function updateDiceAiConfig(input: unknown): ServerDiceAiConfig {
  if (input == null || typeof input !== "object") {
    return getDiceAiConfig();
  }

  const nextConfig = { ...diceAiConfig };
  for (const key of Object.keys(DEFAULT_DICE_AI_CONFIG) as DiceAiConfigKey[]) {
    const value = Number((input as Partial<Record<DiceAiConfigKey, unknown>>)[key]);
    if (!Number.isFinite(value)) {
      continue;
    }

    const limits = DICE_AI_CONFIG_LIMITS[key];
    nextConfig[key] = Math.max(limits.min, Math.min(limits.max, value));
  }

  if (nextConfig.maxDiceWeight < nextConfig.minDiceWeight) {
    nextConfig.maxDiceWeight = nextConfig.minDiceWeight;
  }
  if (nextConfig.forceSixAfterNoSixMaxTurns < nextConfig.forceSixAfterNoSixMinTurns) {
    nextConfig.forceSixAfterNoSixMaxTurns = nextConfig.forceSixAfterNoSixMinTurns;
  }

  diceAiConfig = nextConfig;
  return getDiceAiConfig();
}
