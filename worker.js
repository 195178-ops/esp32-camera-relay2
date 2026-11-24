<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بث كاميرا ESP32</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #121212;
            color: #ffffff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        #status {
            margin-bottom: 15px;
            padding: 8px 16px;
            border-radius: 20px;
            background-color: #333;
            font-size: 14px;
        }
        #stream {
            max-width: 90%;
            max-height: 75vh;
            border: 2px solid #444;
            border-radius: 8px;
            background-color: #000;
        }
    </style>
</head>
<body>

    <div id="status">جاري الاتصال بالخادم...</div>
    <img id="stream" alt="في انتظار البث..." />

    <script>
        const wsUrl = "wss://esp32-camera-relay2.195178.workers.dev/ws?role=viewer";
        const statusEl = document.getElementById("status");
        const imgEl = document.getElementById("stream");
        let lastUrl = null;

        function connect() {
            const ws = new WebSocket(wsUrl);
            ws.binaryType = "blob";

            ws.onopen = () => {
                statusEl.textContent = "متصل - في انتظار الصور من الكاميرا";
                statusEl.style.backgroundColor = "#1b5e20";
            };

            ws.onmessage = (event) => {
                if (event.data instanceof Blob) {
                    statusEl.textContent = "بث مباشر نشط";
                    const newUrl = URL.createObjectURL(event.data);
                    imgEl.src = newUrl;
                    
                    if (lastUrl) {
                        URL.revokeObjectURL(lastUrl);
                    }
                    lastUrl = newUrl;
                } else if (typeof event.data === "string") {
                    if (event.data.startsWith("data:image")) {
                        imgEl.src = event.data;
                    } else {
                        console.log("رسالة نصية من الخادم:", event.data);
                    }
                }
            };

            ws.onclose = () => {
                statusEl.textContent = "انقطع الاتصال. جاري إعادة المحاولة...";
                statusEl.style.backgroundColor = "#b71c1c";
                setTimeout(connect, 3000);
            };

            ws.onerror = (error) => {
                console.error("خطأ في WebSocket:", error);
                ws.close();
            };
        }

        connect();
    </script>
</body>
</html>
