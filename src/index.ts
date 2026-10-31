import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { setupDashboard } from "./dashboard";
import { LudoRoom } from "./rooms/LudoRoom";
import { recordServerLog } from "./serverLog";

const port = Number(process.env.PORT || 2567);

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
