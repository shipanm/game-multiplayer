import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { env } from "./config/env";
import { setupDashboard } from "./dashboard";
import { LudoRoom } from "./rooms/LudoRoom";
import { recordServerLog } from "./serverLog";

const port = env.port;

const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: setupDashboard
});

gameServer.define("ludo_friends", LudoRoom);
gameServer.define("ludo_test_room", LudoRoom);

gameServer.listen(port, undefined, undefined, () => {
  recordServerLog("Server", "listening", {
    websocketUrl: `ws://localhost:${port}`,
    dashboardUrl: `http://localhost:${port}`
  });
});
