import type { ChatDataMessage } from "./ludoTypes";

export interface NormalizedChatMessage {
  requestedPlayerId: string;
  messageType: string;
  data: string;
}

export function normalizeChatMessage(message: ChatDataMessage): NormalizedChatMessage {
  return {
    requestedPlayerId: typeof message.playerId === "string" ? message.playerId : "",
    messageType: typeof message.messageType === "string" ? message.messageType.trim().toLowerCase() : "",
    data: typeof message.data === "string" ? message.data.trim() : ""
  };
}

export function isValidChatMessage(messageType: string, data: string): boolean {
  if (messageType === "emoji") {
    const emojiIndex = Number(data);
    return Number.isInteger(emojiIndex) && emojiIndex >= 0 && emojiIndex <= 100;
  }

  if (messageType === "sticker" || messageType === "quick") {
    return data.length > 0 && data.length <= 64;
  }

  if (messageType === "text") {
    return data.length > 0 && data.length <= 160;
  }

  return false;
}
