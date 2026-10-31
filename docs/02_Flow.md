# 02 — Flows

Actors: **Client** (Unity) · **MP** (this server) · **API** (`game-backend`).

## F1. Join — new build (with token)

1. Client creates or joins a room (`ludo_friends`) and sends its `game-backend` access token.
2. `onAuth`: verify the token with the API's RS256 **public key** — local, no network call.
   - valid and `kind = user` → `userId = sub`, player is **verified**.
   - invalid / expired → refuse the join (client refreshes its token and retries once).
3. MP → `GET /internal/users/:userId/profile` (API key) → name, avatar, frame.
   - fails / times out → use the client-sent `playerProfile` for display. Still verified.
4. Join continues exactly as today: `room_joined`, `room_state`; game starts when the room is full.

## F2. Join — old build (no token)

1. No token → `ALLOW_UNAUTHENTICATED_JOIN=true` → admit as an **unverified guest**, identity from
   `clientKey` (today's behaviour). Flag false → refuse.
2. The old client keeps reporting its own result to the API (`POST /matches/record`), as today.

## F3. Reconnect

- Verified player: reconnect matched by `userId` → same seat.
- Guest: matched by `clientKey`, as today.
- A player who left is already played by a bot (`enableBot`); on return they take the seat back.

## F4. Match end → report

1. Room reaches `game_over` → broadcast to clients (unchanged).
2. MP → `POST /internal/matches/room-result` (API key):

   ```json
   {
     "requestId": "<uuid made in onCreate>",
     "roomCode": "ABC123",
     "gameMode": "classic",
     "startedAt": "2026-10-29T10:00:00Z",
     "endedAt": "2026-10-29T10:14:12Z",
     "players": [
       { "userId": "uuid", "verified": true, "isBot": false, "leftEarly": false, "rank": 1 },
       { "userId": null, "verified": false, "isBot": false, "leftEarly": true, "rank": null }
     ]
   }
   ```

   - `requestId` = `crypto.randomUUID()` made once in `onCreate`: unique per room instance (a room
     **code** can be reused). It must be a UUID — the API stores it in a `uuid` column.
   - The API dedupes on it, so a retry never records twice.
3. Failure (network / 5xx) → retry with backoff (e.g. 1 s, 5 s, 30 s); then log
   `result_report_failed` with the full payload so it can be replayed by hand. 4xx → no retry, log.
4. The room is disposed as today. The report must not hold the room open.

## F5. Dashboard / config change (admin)

1. Admin opens the dashboard with the admin key.
2. `POST /config/dice-ai` / `/config/timing` require `Authorization: Bearer <DASHBOARD_ADMIN_KEY>`.
3. Read-only routes the **client** uses (`/rooms/exists`, `/rooms/player-active`) stay open.
