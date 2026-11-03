import { createGoWildServer } from "./app.ts";
import { createLogger } from "./logger.ts";

const logger = createLogger(false);
const instance = createGoWildServer();

instance.server.listen(instance.config.port, "0.0.0.0", () => {
  logger.info("server.started", {
    port: instance.config.port,
    provider: instance.config.provider,
    nodeEnv: instance.config.nodeEnv,
  });
});

function shutdown(signal: string): void {
  logger.info("server.stopping", { signal });
  instance
    .close()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

