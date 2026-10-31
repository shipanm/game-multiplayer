import { createHash, timingSafeEqual } from "crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env";

// Hash both sides so timingSafeEqual gets equal-length buffers and the key length does not leak.
function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

const expected = digest(env.dashboardAdminKey);

export function isAdminKey(candidate: string): boolean {
  return candidate.length > 0 && timingSafeEqual(digest(candidate), expected);
}

export const adminAuth: RequestHandler = (request, response, next) => {
  const header = request.headers.authorization ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  // EventSource cannot set headers, so /events alone may pass the key as ?key=.
  const queryKey = request.path === "/events" && typeof request.query.key === "string" ? request.query.key : "";

  if (isAdminKey(bearer) || isAdminKey(queryKey)) {
    next();
    return;
  }

  response.status(401).json({ error: "Unauthorized" });
};
