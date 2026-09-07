import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
    // ".fulltang.com" autorise tout sous-domaine de tenant (ex:
    // hopital-central.fulltang.com, clinique-paix.fulltang.com) — même
    // convention que la résolution de tenant côté Gateway
    // (api-gateway/app/config.py::TENANT_ROOT_DOMAIN). Nécessaire
    // uniquement pour pouvoir démontrer le multitenant en local via
    // /etc/hosts ; sans ceci, Vite rejette la requête avant même
    // qu'elle atteigne l'application.
    allowedHosts: ["localhost", "127.0.0.1", ".fulltang.com"],
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    // ".fulltang.com" autorise tout sous-domaine de tenant (ex:
    // hopital-central.fulltang.com, clinique-paix.fulltang.com) — même
    // convention que la résolution de tenant côté Gateway
    // (api-gateway/app/config.py::TENANT_ROOT_DOMAIN). Nécessaire
    // uniquement pour pouvoir démontrer le multitenant en local via
    // /etc/hosts ; sans ceci, Vite rejette la requête avant même
    // qu'elle atteigne l'application.
    allowedHosts: ["localhost", "127.0.0.1", ".fulltang.com"],
  },
});
