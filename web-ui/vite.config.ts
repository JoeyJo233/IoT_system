import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimal ambient type so we don't need the full @types/node dep just to
// read two env vars. Vite runs this file in Node.
declare const process: { env: Record<string, string | undefined> };

// Dev server proxies the two backend services:
//   /api/simulation → producer-service (port 8081) — control plane
//   /api/sensors    → consumer-service (port 8082) — query plane
//
// Override via VITE_PRODUCER_URL / VITE_CONSUMER_URL if running elsewhere.
const PRODUCER = process.env.VITE_PRODUCER_URL ?? "http://localhost:8081";
const CONSUMER = process.env.VITE_CONSUMER_URL ?? "http://localhost:8082";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/simulation": PRODUCER,
      "/api/sensors": CONSUMER,
    },
  },
});
