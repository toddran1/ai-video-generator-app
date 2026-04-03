import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { bootstrapDatabase } from "./db/bootstrap.js";

async function startServer(): Promise<void> {
  await bootstrapDatabase();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`Backend listening on port ${env.PORT}`);
  });
}

void startServer();
