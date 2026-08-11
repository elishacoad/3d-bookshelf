import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const PRESET_DIR = path.resolve(import.meta.dirname, "presets");

/** Presets live as JSON files in ./presets so they survive a different
 *  browser, port, or machine — localStorage is scoped to one origin and
 *  silently strands everything you tuned. */
function presetsApi(): Plugin {
  const fileFor = (id: string) => path.join(PRESET_DIR, `${id.replace(/[^a-z0-9-]/gi, "")}.json`);

  const read = (id: string) => {
    try {
      return JSON.parse(fs.readFileSync(fileFor(id), "utf8"));
    } catch {
      return {};
    }
  };

  return {
    name: "presets-api",
    configureServer(server) {
      server.middlewares.use("/__presets", (req, res) => {
        const id = (req.url || "/").replace(/^\/+/, "").split("?")[0];
        res.setHeader("Content-Type", "application/json");

        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "missing experiment id" }));
          return;
        }

        if (req.method === "GET") {
          res.end(JSON.stringify(read(id)));
          return;
        }

        if (req.method === "POST" || req.method === "PUT") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body || "{}");
              fs.mkdirSync(PRESET_DIR, { recursive: true });
              fs.writeFileSync(fileFor(id), JSON.stringify(parsed, null, 2) + "\n");
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ error: "method not allowed" }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), presetsApi()],
});
