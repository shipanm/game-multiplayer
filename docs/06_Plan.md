# 06 — Plan

`game-backend` endpoints come before the server code that calls them.

## Phase 0 — Move into this repo
- `git init`; copy `ldbz/server/` here unchanged (`src/`, `scripts/`, `package.json`,
  `package-lock.json`, `tsconfig.json`, `.nvmrc`, `.gitignore`). No code change.
- Replace the hard-coded nvm `PATH` in `dev` / `start` scripts with plain `node` (nvm via `.nvmrc`).
- Deploy to `test-multiplayer-ldbz.funbuzz.xyz`, play a room with the current client, then swap live.
- In `ldbz`, leave `server/` until live runs from here; then remove it in its own change.

## Phase 1 — Lock the dashboard (urgent, independent)
- `env.ts`, `.env.example`, `adminAuth.ts` on the dashboard and config routes.
- Verify: config routes 401 without the key; client room list still works.

## Phase 2 — Trusted join + backend profile
- **Needs (game-backend):** API-key guard on `/internal/*`, `GET /internal/users/:id/profile`,
  the public key published to this server's env.
- `jose`, `verifyAccessToken.ts`, `onAuth`, guest flag, `PlayerState.userId/verified`,
  `backendApi.getProfile`.
- **Needs (client):** sends the token on join.
- Verify: new build → `auth_verified`; old build → `auth_guest`; forged token → refused.

## Phase 3 — Report results
- **Needs (game-backend):** `POST /internal/matches/room-result`, deduped on `requestId`.
- `roomResult.ts`, `backendApi.reportRoomResult`, retry, logs.
- **Client:** stops `POST /matches/record` for verified rooms.
- Verify: one row per room in the API even after a forced retry.

## Phase 4 — Leaderboard support
- Only if the leaderboard spec needs more than the winner (full rank order, scores).

## Later
- `ALLOW_UNAUTHENTICATED_JOIN=false` once old builds are negligible.
- Multi-instance (Colyseus Redis presence/driver) only when one instance is not enough.
