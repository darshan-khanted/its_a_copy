import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

import { installConsoleFileLogging } from "./config/logging";
import { isAuthEmulatorEnabled } from "./config/firebase";
import { startGigTimeframeChecks } from "./services/gigMonitor";

import authRoutes from "./routes/auth";
import hoodRoutes from "./routes/hoods";
import emailRoutes from "./routes/emails";
import uploadRoutes from "./routes/uploads";
import cronRoutes from "./routes/cron";
import adminRoutes from "./routes/admin";

installConsoleFileLogging();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  if (isAuthEmulatorEnabled()) {
    console.log(
      `[Auth] Firebase Auth emulator enabled via FIREBASE_AUTH_EMULATOR_HOST=${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,
    );
  }

  // ---- API routers (mounted before the SPA fallback) ----
  app.use("/api/auth", authRoutes);
  app.use("/api/hoods", hoodRoutes);
  app.use("/api/emails", emailRoutes);
  app.use("/api", uploadRoutes); // POST /api/upload
  app.use("/api/cron", cronRoutes);
  app.use("/api/admin", adminRoutes);

  // Serve uploaded files as a static endpoint (read-only).
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Vite middleware for development, static dist in production.
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start the background gig timeframe checker.
  startGigTimeframeChecks();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
