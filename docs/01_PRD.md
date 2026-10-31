# 01 — PRD: LDBZ Multiplayer Server (Colyseus)

**Status:** draft (2026-10-29) · repo created, no code yet

## What this is

The realtime match server for **Ludo Buzz**. It runs friend / room-code Ludo matches between real
players: rooms, server-rolled dice, move validation, turn timers, bot takeover, reconnect, in-match
chat.

It is a **separate system** from `game-backend` (the NestJS + Postgres API):

- **It keeps no data.** No database. Room state lives in memory for the life of a room.
- **It calls `game-backend`** for anything about a user, and to report every finished match.
- **It is the authority for a match** — the client sends intent (roll, move); the server decides.

## Starting point

The server already exists and is **live** at `multiplayer-ldbz.funbuzz.xyz` (test:
`test-multiplayer-ldbz.funbuzz.xyz`). Its code sits in the Unity repo at `ldbz/server/`.
This repo becomes its new home: **move that code here as-is first**, then build on it.
(Assumption — confirm: move, not rewrite.)

## Why change it

- **Anyone can be anyone.** A player's identity is a client-sent `clientKey`; there is no login check.
- **Results never leave the room.** The client reports its own result — untrustworthy for a
  leaderboard or any reward.
- **Profiles are client-supplied** (name / avatar sent by the client).
- **The dashboard has no auth.** `POST /config/dice-ai` and `POST /config/timing` change live dice
  and timing for every room, and anyone who knows the URL can call them.

## What we build

1. **Own repo** with the existing code, its own `.env.example`, `CLAUDE.md`, deploy notes.
2. **Lock the dashboard** (admin key) — the live server is exposed today.
3. **Login check on join** — verify the `game-backend` access token; `playerId` = backend user id.
4. **Profiles from `game-backend`** — name, avatar, frame read server to server.
5. **Report every finished match** to `game-backend`, server to server, once, with an idempotency id.
6. **Old-build compatibility** — players without a token join as unverified guests behind a flag.

## Out of scope

- Friends, invites, leaderboard **storage or logic** — those live in `game-backend`. Invites need
  nothing from this server: an accepted invite is a normal join by room code.
- Random matchmaking with strangers.
- Any database, cache or queue.
- Changing the gameplay rules or the client ↔ server message protocol.

## The game is live

- **Shipped Unity builds connect to this server today.** Room names (`ludo_friends`,
  `ludo_test_room`), join options, and every message name and shape stay exactly as they are.
- **Old builds send no token.** They keep getting in as guests while `ALLOW_UNAUTHENTICATED_JOIN=true`.
- **The move must not drop live rooms.** Deploy the moved code to the test endpoint first, then
  swap live at a quiet hour; a running room is lost on restart (as today).

## Related

- Client side: `ldbz/docs/friends-multiplayer/` (Unity client plan for friends, invites, multiplayer).
- Backend side: `game-backend/docs/friends/` — owns the `/internal/*` endpoints this server calls.

## Open questions

1. Move the existing `ldbz/server/` code here, or rewrite? (Docs assume **move**.)
2. Where is it deployed today, and how (pm2 / systemd / Docker)? Not documented in the Unity repo.
3. Leaderboard needs: full rank order, or winner only? Today the room only knows the winner.
