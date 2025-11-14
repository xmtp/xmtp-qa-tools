import express from "express";
import fs from "fs/promises";
import path from "path";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const metaString = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : "";
      return `${timestamp} [${level}] ${message}${metaString}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

const app = express();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const relativeFilePath = "data/db-backup.tar.gz";
const dataDir = "/app/data";
const absoluteFilePath = path.join("/app", relativeFilePath);

app.use((req, res, next) => {
  logger.info("Incoming request", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });
  res.on("finish", () => {
    logger.info("Request completed", {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
    });
  });
  next();
});

app.get("/", (req, res) => {
  logger.info("Serving landing page");
  res.type("html").send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>XMTP QA Tools Backup</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #0f172a;
            color: #e2e8f0;
          }
          main {
            background: rgba(15, 23, 42, 0.85);
            padding: 2.5rem 3rem;
            border-radius: 1rem;
            box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.45);
            max-width: 480px;
            text-align: center;
          }
          h1 {
            margin-top: 0;
            margin-bottom: 1rem;
            font-size: 2rem;
          }
          p {
            margin-bottom: 2rem;
            line-height: 1.5;
          }
          a.button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.85rem 1.75rem;
            border-radius: 999px;
            background: linear-gradient(135deg, #60a5fa, #22d3ee);
            color: #0f172a;
            font-weight: 600;
            text-decoration: none;
            transition: transform 150ms ease, box-shadow 150ms ease;
            box-shadow: 0 8px 20px rgba(34, 211, 238, 0.35);
          }
          a.button:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 24px rgba(96, 165, 250, 0.4);
          }
          footer {
            margin-top: 1.5rem;
            font-size: 0.85rem;
            color: rgba(226, 232, 240, 0.75);
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Download Backup</h1>
          <p>Click the button below to download <code>db-backup.tar.gz</code> from the running service.</p>
          <a class="button" href="/download" download>Download backup</a>
          <footer>Logged service path: <code>${relativeFilePath}</code></footer>
        </main>
      </body>
    </html>
  `);
});

app.get("/download", async (req, res) => {
  try {
    const stat = await fs.stat(absoluteFilePath);
    logger.info("Initiating download", {
      file: absoluteFilePath,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
    res.download(absoluteFilePath, "db-backup.tar.gz", (err) => {
      if (err) {
        logger.error("Download failed", { error: err.message });
      } else {
        logger.info("Download completed");
      }
    });
  } catch (error) {
    logger.error("File missing or unreadable", {
      error: error instanceof Error ? error.message : String(error),
      attemptedPath: absoluteFilePath,
      dataDirExists: await fs
        .access(dataDir)
        .then(() => true)
        .catch(() => false),
    });
    res
      .status(404)
      .json({ error: "Backup file not found", path: absoluteFilePath });
  }
});

app.listen(port, () => {
  logger.info("Backup download server ready", {
    port,
    filePath: absoluteFilePath,
  });
});

