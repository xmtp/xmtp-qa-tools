import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import winston from "winston";

type DirectoryEntry = {
  name: string;
  sizeBytes: number;
  updatedAt: string;
};

type DirectorySnapshot = {
  files: DirectoryEntry[];
  totalBytes: number;
};

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { level, message, timestamp, ...meta } =
        info as winston.Logform.TransformableInfo & { timestamp?: string };
      const safeTimestamp =
        typeof timestamp === "string" ? timestamp : new Date().toISOString();
      const safeMessage =
        typeof message === "string" ? message : JSON.stringify(message);
      const metaRecord = meta as Record<string, unknown>;
      const metaString = Object.keys(metaRecord).length
        ? ` ${JSON.stringify(metaRecord)}`
        : "";
      return `${safeTimestamp} [${level}] ${safeMessage}${metaString}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

const app = express();
const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const relativeFilePath = "data/db-backup.tar.gz";
const dataDir = "/app/data";
const defaultFileName = "db-backup.tar.gz";
const defaultFilePath = path.join(dataDir, defaultFileName);

const getDataDirSnapshot = async (): Promise<DirectorySnapshot> => {
  try {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());

    const snapshot = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dataDir, file.name);
        const stat = await fs.stat(filePath);
        return {
          name: file.name,
          sizeBytes: stat.size,
          updatedAt: stat.mtime.toISOString(),
        };
      }),
    );

    snapshot.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    const totalBytes = snapshot.reduce((sum, file) => sum + file.sizeBytes, 0);

    logger.info("Data directory snapshot collected", {
      dataDir,
      fileCount: snapshot.length,
      totalBytes,
      readableTotal: formatBytes(totalBytes),
      largestFile: snapshot[0]
        ? {
            name: snapshot[0].name,
            sizeBytes: snapshot[0].sizeBytes,
            updatedAt: snapshot[0].updatedAt,
          }
        : null,
      sample: snapshot.slice(0, 5).map((file) => ({
        name: file.name,
        sizeBytes: file.sizeBytes,
        updatedAt: file.updatedAt,
      })),
    });

    return { files: snapshot, totalBytes };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to read data directory", {
      error: message,
      attemptedPath: dataDir,
    });
    return { files: [], totalBytes: 0 };
  }
};

const formatBytes = (size: number) => {
  if (!Number.isFinite(size) || size < 0) return "Unknown";

  if (size === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const formatted = size / 1024 ** exponent;

  return `${formatted.toFixed(formatted >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
};

const sanitizeRequestedFile = (requestedFile?: string) => {
  if (!requestedFile) return defaultFileName;
  const normalized = path.normalize(requestedFile).replace(/^[/\\]+/, "");
  const baseName = path.basename(normalized);
  return baseName || defaultFileName;
};

app.use((req: Request, res: Response, next: NextFunction) => {
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

  req.on("aborted", () => {
    logger.warn("Request aborted by client", {
      method: req.method,
      url: req.originalUrl,
    });
  });

  next();
});

app.get("/", async (req: Request, res: Response) => {
  logger.info("Serving landing page with directory contents");
  const snapshot = await getDataDirSnapshot();
  const files = snapshot.files;
  const totalBytes = snapshot.totalBytes;
  const hasFiles = files.length > 0;
  const downloadCards = hasFiles
    ? files
        .map(
          (file) => `
            <tr>
              <td><code>${file.name}</code></td>
              <td>${formatBytes(file.sizeBytes)}</td>
              <td>${new Date(file.updatedAt).toLocaleString()}</td>
              <td><a class="button-secondary" href="/download?file=${encodeURIComponent(
                file.name,
              )}" download>Download</a></td>
            </tr>
          `,
        )
        .join("\n")
    : `
        <tr>
          <td colspan="4" class="empty">
            No files detected in <code>${dataDir}</code>. Place your backups here to enable downloads.
          </td>
        </tr>
      `;

  res.type("html").send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>XMTP QA Tools Backups</title>
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
            width: min(90vw, 720px);
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
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1.5rem;
          }
          th, td {
            padding: 0.75rem 1rem;
            text-align: left;
            border-bottom: 1px solid rgba(148, 163, 184, 0.3);
          }
          th {
            font-weight: 600;
            letter-spacing: 0.02em;
            text-transform: uppercase;
            font-size: 0.75rem;
            color: rgba(226, 232, 240, 0.8);
          }
          td code {
            background: rgba(148, 163, 184, 0.15);
            padding: 0.1rem 0.4rem;
            border-radius: 0.4rem;
          }
          .button-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.5rem 1.25rem;
            border-radius: 999px;
            background: rgba(226, 232, 240, 0.95);
            color: #0f172a;
            font-weight: 600;
            text-decoration: none;
            transition: transform 150ms ease, box-shadow 150ms ease;
            box-shadow: 0 8px 20px rgba(226, 232, 240, 0.25);
          }
          .button-secondary:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 24px rgba(226, 232, 240, 0.35);
          }
          .empty {
            text-align: center;
            color: rgba(226, 232, 240, 0.65);
            font-style: italic;
          }
          .directory-meta {
            margin-top: 1rem;
            font-size: 0.9rem;
            color: rgba(226, 232, 240, 0.8);
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Download Backup</h1>
          <p>Click a download button below to retrieve files from the running service.</p>
          <div class="directory-meta">
            Monitoring directory: <code>${dataDir}</code><br />
            Default file: <code>${relativeFilePath}</code><br />
            Total size: <strong>${formatBytes(totalBytes)}</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
                <th>Last Modified</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${downloadCards}
            </tbody>
          </table>
          <footer>Logged service path: <code>${relativeFilePath}</code></footer>
        </main>
      </body>
    </html>
  `);
});

app.get("/download", async (req: Request, res: Response) => {
  const fileParam = req.query.file;
  let requestedFileRaw: string | undefined;
  if (typeof fileParam === "string") {
    requestedFileRaw = fileParam;
  } else if (Array.isArray(fileParam)) {
    const [first] = fileParam;
    requestedFileRaw = typeof first === "string" ? first : undefined;
  } else {
    requestedFileRaw = undefined;
  }
  const sanitizedFile = sanitizeRequestedFile(requestedFileRaw);
  const resolvedPath = path.resolve(dataDir, sanitizedFile);

  logger.info("Download request received", {
    requestedFile: requestedFileRaw,
    sanitizedFile,
    resolvedPath,
  });

  if (
    resolvedPath !== dataDir &&
    !resolvedPath.startsWith(`${dataDir}${path.sep}`)
  ) {
    logger.warn("Rejected download outside of data directory", {
      resolvedPath,
      dataDir,
    });
    res.status(400).json({
      error: "Invalid file path",
      detail: "Requested file must reside inside the data directory",
    });
    return;
  }

  try {
    const stat = await fs.stat(resolvedPath);

    if (!stat.isFile()) {
      logger.warn("Requested path is not a file", {
        resolvedPath,
        isDirectory: stat.isDirectory(),
      });
      res.status(404).json({
        error: "Requested path is not a file",
        path: resolvedPath,
      });
      return;
    }

    logger.info("Initiating download", {
      file: resolvedPath,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedFile}"`,
    );
    res.setHeader("Content-Length", stat.size);

    const stream = createReadStream(resolvedPath);
    let bytesSent = 0;

    stream.on("open", () => {
      logger.info("Streaming download started", {
        file: resolvedPath,
        expectedBytes: stat.size,
      });
    });

    stream.on("data", (chunk) => {
      bytesSent += chunk.length;
    });

    stream.on("close", () => {
      logger.info("Streaming download closed", {
        file: resolvedPath,
        expectedBytes: stat.size,
        bytesSent,
        fullySent: bytesSent === stat.size,
      });
    });

    stream.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Error while streaming file", {
        file: resolvedPath,
        error: message,
      });
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to read file",
          detail: message,
        });
      } else {
        res.destroy(error as Error);
      }
    });

    res.on("close", () => {
      logger.info("Response closed by client", {
        file: resolvedPath,
        bytesSent,
        expectedBytes: stat.size,
      });
    });

    stream.pipe(res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    logger.error("File missing or unreadable", {
      error: message,
      attemptedPath: resolvedPath,
      dataDirExists: await fs
        .access(dataDir)
        .then(() => true)
        .catch(() => false),
    });
    res.status(404).json({
      error: "Backup file not found",
      path: resolvedPath,
      detail: message,
    });
  }
});

app.listen(port, () => {
  void (async () => {
    const dataDirExists = await fs
      .access(dataDir)
      .then(() => true)
      .catch(() => false);

    logger.info("Backup download server ready", {
      port,
      defaultFilePath,
      dataDir,
      dataDirExists,
      ...(dataDirExists
        ? await (async () => {
            const snapshot = await getDataDirSnapshot();
            return {
              fileCount: snapshot.files.length,
              totalBytes: snapshot.totalBytes,
              readableTotal: formatBytes(snapshot.totalBytes),
            };
          })()
        : {}),
    });

    if (dataDirExists) {
      await getDataDirSnapshot();
    } else {
      logger.warn("Data directory does not exist yet", { dataDir });
    }
  })();
});
