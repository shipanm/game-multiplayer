# 04 — TRD

## Stack

- **Node 22.12** (`.nvmrc`), **TypeScript strict**, **Colyseus 0.17** + `@colyseus/ws-transport`,
  `@colyseus/schema` 4, Express 4 (Colyseus' own HTTP layer, for the dashboard).
- **Why not NestJS / plain Express:** Colyseus is the room / state-sync / reconnect engine and the
  existing ~2,300 lines are written for it. With no database and two outgoing calls, NestJS adds
  structure without solving anything; plain Express would mean rebuilding rooms.
- **New dependency:** `jose` — verifies RS256 JWTs, no native code. Nothing else.

## Layout (moved from `ldbz/server/`, unchanged at first)

```
src/
  index.ts                     boot, room registration, dashboard
  rooms/LudoRoom.ts            the room
  rooms/ludoRules.ts           move legality, captures, win      (pure)
  rooms/ludoDiceAi.ts          dice logic                         (pure)
  rooms/ludoBotAi.ts           bot pawn choice                    (pure)
  rooms/ludoPlayers.ts, ludoTurnBonus.ts, ludoTimers.ts, ludoChat.ts, ludoSnapshots.ts, ludoTypes.ts
  dashboard.ts, dashboardHtml.ts, roomMatchmakingRegistry.ts, serverTimingConfig.ts,
  serverDiceAiConfig.ts, serverLog.ts
scripts/smoke-ludo-helpers.js  node:assert smoke over dist/
```

New files:

```
src/config/env.ts              read + validate env once at boot; fail fast on a missing required key
src/auth/verifyAccessToken.ts  jose RS256 verify → { userId } | null              (pure-ish)
src/backend/backendApi.ts      getProfile(), reportRoomResult() with timeout + retry
src/backend/roomResult.ts      build the report payload from room state           (pure)
src/dashboard/adminAuth.ts     Express middleware: Bearer DASHBOARD_ADMIN_KEY, timing-safe compare
```

## Auth on join

- `LudoRoom.onAuth`: read the token Colyseus hands over (**confirm the exact 0.17 signature** —
  `onAuth(client, options, context)` with `context.token`, set on the client via `client.auth.token`).
- Verify: signature (RS256, `BACKEND_JWT_PUBLIC_KEY`), `exp`, `kind === "user"`. `sub` → `userId`.
- Return `{ userId, verified: true }` or, with no token and the flag on, `{ verified: false }`.
  Bad token → throw (join refused) — a bad token is never downgraded to a guest.
- `PlayerState` += `userId: string | null`, `verified: boolean`.
- Ignore the client's `playerId` option, as today (`client_player_id_ignored`).

## Backend calls

- Base URL `BACKEND_API_URL`, header `Authorization: Bearer ${MULTIPLAYER_API_KEY}`.
- `fetch` (Node 22 built-in) with `AbortSignal.timeout(5000)`.
- Profile: no retry; failure → client profile fallback. Never blocks a join beyond the timeout.
- Result: retry on network / 5xx with backoff 1 s → 5 s → 30 s; 4xx no retry. Runs detached from
  room disposal. Final failure logs the full payload (`result_report_failed`).
- Response envelope is `game-backend`'s `{ status, code, message, data }`.

## Result payload

See `02_Flow.md` F4. `requestId` is a UUID from `crypto.randomUUID()` in `onCreate`, kept on the
room. `rank`: the room records only `winnerPlayerIds` today → winner `1`, others
`null` until the leaderboard spec asks for more.

## Dashboard auth

- `adminAuth` middleware on every dashboard route except `POST /rooms/exists` and
  `POST /rooms/player-active`. The HTML dashboard sends the key as a header (prompt once, keep in
  `sessionStorage`). `crypto.timingSafeEqual` for the compare.

## Env (`.env.example` lists all, placeholders only)

| Key | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `2567` | listen port (exists today) |
| `BACKEND_API_URL` | yes | — | `game-backend` base, incl. `/api/v1` |
| `MULTIPLAYER_API_KEY` | yes | — | shared secret; same value in `game-backend` |
| `BACKEND_JWT_PUBLIC_KEY` | yes | — | RS256 public key of `game-backend` access tokens |
| `ALLOW_UNAUTHENTICATED_JOIN` | no | `true` | admit token-less old builds as guests |
| `DASHBOARD_ADMIN_KEY` | yes | — | dashboard + config routes |

Env is loaded with Node's `--env-file` (Node 22) — no `dotenv` dependency.

## Logging

Keep `serverLog.ts` structured logs. New events: `auth_verified`, `auth_guest`, `auth_refused`,
`profile_fetch_failed`, `result_reported`, `result_report_failed`.

## Testing

- No test framework (as today). Extend `scripts/smoke-ludo-helpers.js` for the new pure helpers:
  token-claims check (`verifyAccessToken` with a test key pair) and `roomResult` builder.
- Manual: a new build verified end to end; an old build admitted as guest; the dashboard 401 without key.
