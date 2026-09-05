const pino = require("pino");

// Pretty-printed in dev (npm run dev/worker), plain JSON lines in production
// (containers/hosting expect structured logs, not ANSI-colored text).
const logger = pino(
  process.env.NODE_ENV === "production"
    ? {}
    : { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }
);

module.exports = logger;
