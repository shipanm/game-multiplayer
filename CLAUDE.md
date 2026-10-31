# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

The **LDBZ (Ludo Buzz) multiplayer server** — Colyseus 0.17, Node 22, TypeScript strict. It runs
realtime friend / room-code Ludo matches. Design docs:

1. [01_PRD](docs/01_PRD.md) — what and why
2. [02_Flow](docs/02_Flow.md) — join, reconnect, match-end report, dashboard
3. [03_UI](docs/03_UI.md) — consumer view: client protocol, backend calls, dashboard routes
4. [04_TRD](docs/04_TRD.md) — stack, layout, auth, env
5. [05_DB](docs/05_DB.md) — there is no database
6. [06_Plan](docs/06_Plan.md) — phases

## Rules

- **No data here.** No database, cache or file storage. User data, friends, invites, results and
  leaderboards live in `game-backend` (`/Users/shipansm/Personal/Tapas/game-backend`); this server
  calls it with `Authorization: Bearer <MULTIPLAYER_API_KEY>`.
- **The game is LIVE and old Unity builds connect here.** Never rename a room (`ludo_friends`,
  `ludo_test_room`), a join option, a message name or a message field. New fields are optional.
  Players with no token must still get in while `ALLOW_UNAUTHENTICATED_JOIN=true`.
- **The server is the authority.** Client messages are intent; dice, move legality, turn order and
  the winner are decided here. Never accept a client-sent result or `playerId`.
- **Keep game rules pure** (`ludoRules`, `ludoDiceAi`, `ludoBotAi`, …) so the smoke script covers them.
- **Every env key** goes into `.env.example` with a placeholder — never a real secret.
- Never start the server yourself (`npm run dev` / `npm start`) — ask the user.
  `npm run build` and `tsc` are fine.
- Always answer in English.

## Commands

```bash
npm install
npm run build                                   # tsc -> dist/
node scripts/smoke-ludo-helpers.js              # after a build; ask before running
```

## Related

- Unity client plan: `ldbz/docs/friends-multiplayer/`
- Backend: `game-backend/docs/friends/`
