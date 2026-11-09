import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), {
    name: "development-status",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/status", (_request, response) => {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>딸기마을 연결 확인</title><body style="margin:32px;background:white;color:#234;font:18px sans-serif"><h1>딸기마을 개발 서버</h1><p>개발 서버에 정상적으로 연결되었습니다.</p><a href="/">마을 열기</a></body></html>');
      });
    },
  }],
  server: {
    host: "0.0.0.0", port: 5173, strictPort: true,
    hmr: true,
    headers: { "Cache-Control": "no-store" },
    watch: { usePolling: true, interval: 300 },
  },
  build: { outDir: "build", emptyOutDir: true },
});
