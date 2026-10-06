import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** In sviluppo esegue le funzioni di api/*.ts (in produzione le esegue Vercel). */
function apiInSviluppo(): Plugin {
  return {
    name: "api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([\w-]+)(\?.*)?$/);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`);
          const handler = mod[req.method ?? "GET"];
          if (!handler) return next();
          const body = req.method === "POST" ? await new Promise<string>((ok) => {
            let d = "";
            req.on("data", (c) => (d += c));
            req.on("end", () => ok(d));
          }) : undefined;
          const r: Response = await handler(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers as HeadersInit, body }));
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await r.arrayBuffer()));
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiInSviluppo()],
  server: { host: true },
  // Firebase pesa ~240 kB gzip: accettabile per questa app.
  build: { chunkSizeWarningLimit: 1000 },
});
