
export class CameraRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket required", { status: 426 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get("role");

    if (!["camera", "viewer"].includes(role)) {
      return new Response("Invalid role", { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws, message) {
    const info = ws.deserializeAttachment();

    if (info?.role !== "camera") return;

    for (const peer of this.ctx.getWebSockets()) {
      const peerInfo = peer.deserializeAttachment();

      if (
        peerInfo?.role === "viewer" &&
        peer.readyState === WebSocket.OPEN
      ) {
        try {
          peer.send(message);
        } catch (error) {
          console.error("Viewer send failed");
        }
      }
    }
  }

  async webSocketClose(ws) {
    try {
      ws.close();
    } catch {}
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("ESP32 Camera Relay Server Online");
    }

    if (url.pathname === "/ws") {
      const role = url.searchParams.get("role");
      const token = url.searchParams.get("token");

      if (role === "camera" && token !== env.CAMERA_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (role === "viewer" && token !== env.VIEWER_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (!["camera", "viewer"].includes(role)) {
        return new Response("Invalid role", { status: 400 });
      }

      const id = env.CAMERA_ROOM.idFromName("main-camera");
      const room = env.CAMERA_ROOM.get(id);

      return room.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
