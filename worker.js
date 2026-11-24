
export class CameraRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("ESP32 Camera Relay is running", {
        status: 200
      });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get("role");

    if (!["camera", "viewer"].includes(role)) {
      return new Response("Invalid role", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws, message) {
    const attachment = ws.deserializeAttachment();
    if (!attachment) return;

    if (attachment.role === "camera") {
      for (const peer of this.ctx.getWebSockets()) {
        const info = peer.deserializeAttachment();

        if (info?.role === "viewer" &&
            peer.readyState === WebSocket.OPEN) {
          try {
            peer.send(message);
          } catch {}
        }
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    if (code >= 1000 && code < 5000 &&
        ![1004, 1005, 1006, 1015].includes(code)) {
      ws.close(code, reason);
    } else {
      ws.close();
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        "ESP32 Camera Relay Server Online",
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    if (url.pathname === "/ws") {
      const id = env.CAMERA_ROOM.idFromName("main-camera");
      const room = env.CAMERA_ROOM.get(id);
      return room.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
