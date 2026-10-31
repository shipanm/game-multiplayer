export function secondsToTimerMs(seconds: number): number {
  return Math.max(1, Math.round(seconds * 1000));
}
