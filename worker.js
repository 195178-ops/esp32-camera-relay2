
const viewerPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32 Camera Live</title>
<style>
body {
  margin: 0;
  background: #101010;
  color: white;
  font-family: Arial, sans-serif;
  text-align: center;
}
h2 { margin: 20px 0; }
#video {
  width: 100%;
  max-width: 900px;
  height: auto;
  background: #000;
}
#status {
  padding: 15px;
  color: #ffd166;
}
</style>
</head>
<body>
<h2>ESP32 Camera Live</h2>
<div id="status">Connecting...</div>
<img id="video" alt="Camera stream">
<script>
const status = document.getElementById("status");
const video = document.getElementById("video");

let socket;
let previousURL = null;

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(
    protocol + "//" + location.host + "/ws?role=viewer"
  );

  socket.binaryType = "blob";

  socket.onopen = () => {
    status.textContent = "Connected - Waiting for camera...";
  };

  socket.onmessage = (event) => {
    const blob = new Blob([event.data], { type: "image/jpeg" });
    const newURL = URL.createObjectURL(blob);

    video.onload = () => {
      if (previousURL) URL.revokeObjectURL(previousURL);
      previousURL = newURL;
    };

    video.src = newURL;
    status.textContent = "LIVE";
  };

  socket.onclose = () => {
    status.textContent = "Disconnected - Reconnecting...";
    setTimeout(connect, 2000);
  };

  socket.onerror = () => {
    status.textContent = "Connection error";
    socket.close();
  };
}

connect();
</script>
</body>
</html>`;

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
      return new Response(viewerPage, {
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Cache-Control": "no-store"
        }
      });
    }

    if (url.pathname === "/ws") {
      const role = url.searchParams.get("role");
      const token = url.searchParams.get("token");

      if (role === "camera" && token !== env.CAMERA_TOKEN) {
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
