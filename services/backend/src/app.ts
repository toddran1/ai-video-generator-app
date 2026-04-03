import express from "express";
import { env } from "./config/env.js";
import { HttpError } from "./lib/http-error.js";
import { generateRouter } from "./modules/generate/generate.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use("/assets", express.static(env.ASSET_ROOT));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "backend" });
  });

  app.use("/projects", projectsRouter);
  app.use("/generate", generateRouter);

  app.use((_req, _res, next) => {
    next(new HttpError(404, "Route not found"));
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: "Unknown server error" });
  });

  return app;
}
