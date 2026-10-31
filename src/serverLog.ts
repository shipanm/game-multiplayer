export interface ServerLogEntry {
  timestamp: string;
  source: string;
  eventName: string;
  details: unknown;
}

type LogSubscriber = (entry: ServerLogEntry) => void;

const maxLogEntries = 300;
const logEntries: ServerLogEntry[] = [];
const subscribers = new Set<LogSubscriber>();

export function recordServerLog(source: string, eventName: string, details: unknown = {}) {
  const entry: ServerLogEntry = {
    timestamp: new Date().toISOString(),
    source,
    eventName,
    details
  };

  logEntries.push(entry);
  if (logEntries.length > maxLogEntries) {
    logEntries.shift();
  }

  console.log(formatServerLog(entry), details);

  for (const subscriber of subscribers) {
    subscriber(entry);
  }
}

export function getServerLogs() {
  return [...logEntries];
}

export function subscribeServerLogs(subscriber: LogSubscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function formatServerLog(entry: ServerLogEntry) {
  return `[${entry.timestamp}] [${entry.source}] ${entry.eventName}`;
}
