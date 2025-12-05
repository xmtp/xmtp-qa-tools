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

// Middleware to handle raw binary uploads for /upload endpoint
app.use(
  "/upload",
  express.raw({ type: "*/*", limit: "10gb" }),
  (req: Request, res: Response, next: NextFunction) => {
    next();
  },
);

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
              <td style="white-space: nowrap;">
                <a class="button-icon" href="/download?file=${encodeURIComponent(
                  file.name,
                )}" download title="Download file">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </a>
              </td>
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
        <title>XMTP DB Backups</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            min-height: 100vh;
            margin: 0;
            padding: 4rem 1.5rem;
            background: #ffffff;
            color: #1d1d1f;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          main {
            background: #ffffff;
            padding: 0;
            max-width: 900px;
            width: 100%;
            text-align: left;
          }
          h1 {
            margin: 0 0 0.5rem 0;
            font-size: 3rem;
            font-weight: 600;
            letter-spacing: -0.02em;
            color: #1d1d1f;
          }
          p {
            margin: 0 0 3rem 0;
            font-size: 1.25rem;
            line-height: 1.5;
            color: #86868b;
            font-weight: 400;
          }
          footer {
            margin-top: 3rem;
            font-size: 0.875rem;
            color: #86868b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 2rem;
          }
          thead {
            border-bottom: 1px solid #d2d2d7;
          }
          th, td {
            padding: 1rem 1.25rem;
            text-align: left;
          }
          th {
            font-weight: 500;
            font-size: 0.875rem;
            color: #86868b;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding-bottom: 0.75rem;
          }
          tbody tr {
            border-bottom: 1px solid #f5f5f7;
            transition: background-color 0.2s ease;
          }
          tbody tr:hover {
            background-color: #fafafa;
          }
          tbody tr:last-child {
            border-bottom: none;
          }
          td {
            font-size: 1rem;
            color: #1d1d1f;
            vertical-align: middle;
          }
          td code {
            background: #f5f5f7;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
            font-size: 0.875rem;
            color: #1d1d1f;
          }
          .button-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.5rem;
            border-radius: 6px;
            background: rgb(162, 36, 15);
            color: #ffffff;
            border: none;
            cursor: pointer;
            width: 2rem;
            height: 2rem;
            transition: all 0.2s ease;
            text-decoration: none;
          }
          .button-icon:hover {
            background: rgb(180, 40, 17);
            transform: translateY(-1px);
          }
          .button-icon:active {
            background: rgb(140, 31, 13);
            transform: translateY(0);
          }
          .button-icon svg {
            width: 16px;
            height: 16px;
          }
          .empty {
            text-align: center;
            color: #86868b;
            font-style: italic;
            padding: 3rem 1rem;
          }
          .directory-meta {
            margin-top: 2rem;
            font-size: 0.875rem;
            color: #86868b;
            line-height: 1.8;
          }
          .directory-meta code {
            background: #f5f5f7;
            padding: 0.125rem 0.375rem;
            border-radius: 4px;
            font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
            font-size: 0.8125rem;
            color: #1d1d1f;
          }
          .directory-meta strong {
            color: #1d1d1f;
            font-weight: 500;
          }
          footer code {
            background: #f5f5f7;
            padding: 0.125rem 0.375rem;
            border-radius: 4px;
            font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
            font-size: 0.8125rem;
            color: #1d1d1f;
          }
          .instructions-section {
            background: #fafafa;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            border: 1px solid #e5e5e7;
          }
          .instructions-section h2 {
            margin: 0 0 1.5rem 0;
            font-size: 1.5rem;
            font-weight: 600;
            color: #1d1d1f;
          }
          .instruction-block {
            margin-bottom: 2rem;
          }
          .instruction-block:last-child {
            margin-bottom: 0;
          }
          .instruction-block h3 {
            margin: 0 0 0.75rem 0;
            font-size: 1.125rem;
            font-weight: 500;
            color: #1d1d1f;
          }
          .instruction-description {
            margin: 0 0 0.75rem 0;
            font-size: 0.9375rem;
            color: #86868b;
            line-height: 1.5;
          }
          .instruction-note {
            margin: 0.75rem 0 0 0;
            font-size: 0.875rem;
            color: #86868b;
            line-height: 1.5;
          }
          .code-block-container {
            position: relative;
            background: #1d1d1f;
            border-radius: 8px;
            padding: 1rem;
            margin: 0.75rem 0;
          }
          .code-block {
            margin: 0;
            padding: 0;
            background: transparent;
            color: #f5f5f7;
            font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
            font-size: 0.875rem;
            line-height: 1.6;
            overflow-x: auto;
            white-space: pre;
          }
          .code-block code {
            background: transparent;
            padding: 0;
            color: #f5f5f7;
            font-size: inherit;
          }
          .copy-button {
            position: absolute;
            top: 0.75rem;
            right: 0.75rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.5rem;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.1);
            color: #f5f5f7;
            border: 1px solid rgba(255, 255, 255, 0.2);
            cursor: pointer;
            width: 2rem;
            height: 2rem;
            transition: all 0.2s ease;
          }
          .copy-button:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.3);
          }
          .copy-button:active {
            background: rgba(255, 255, 255, 0.15);
          }
          .copy-button.copied {
            background: #30d158;
            border-color: #30d158;
            color: #ffffff;
          }
          .copy-button svg {
            width: 16px;
            height: 16px;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>XMTP DB Backups</h1>
          <p>Download files from the running service.</p>
          
       
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
        </main>
        <script>
          async function deleteFile(filename) {
            if (!confirm('Are you sure you want to delete "' + decodeURIComponent(filename) + '"? This action cannot be undone.')) {
              return;
            }
            try {
              const response = await fetch('/delete?file=' + encodeURIComponent(filename), {
                method: 'DELETE'
              });
              if (response.ok) {
                location.reload();
              } else {
                const error = await response.json();
                alert('Error deleting file: ' + (error.detail || error.error || 'Unknown error'));
              }
            } catch (error) {
              alert('Error deleting file: ' + error.message);
            }
          }
          
          async function copyToClipboard(button, text) {
            try {
              await navigator.clipboard.writeText(text);
              const originalHTML = button.innerHTML;
              button.classList.add('copied');
              button.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 4L6 11L3 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
              setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = originalHTML;
              }, 2000);
            } catch (error) {
              alert('Failed to copy: ' + error.message);
            }
          }
        </script>
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

app.delete("/delete", async (req: Request, res: Response) => {
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

  logger.info("Delete request received", {
    requestedFile: requestedFileRaw,
    sanitizedFile,
    resolvedPath,
  });

  if (
    resolvedPath !== dataDir &&
    !resolvedPath.startsWith(`${dataDir}${path.sep}`)
  ) {
    logger.warn("Rejected delete outside of data directory", {
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

    await fs.unlink(resolvedPath);

    logger.info("File deleted successfully", {
      file: resolvedPath,
      sizeBytes: stat.size,
    });

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
      filename: sanitizedFile,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    logger.error("Error deleting file", {
      error: message,
      attemptedPath: resolvedPath,
    });
    res.status(500).json({
      error: "Failed to delete file",
      detail: message,
    });
  }
});

app.post("/upload", async (req: Request, res: Response) => {
  const fileParam = req.query.filename;
  let requestedFileRaw: string | undefined;
  if (typeof fileParam === "string") {
    requestedFileRaw = fileParam;
  } else if (Array.isArray(fileParam)) {
    const [first] = fileParam;
    requestedFileRaw = typeof first === "string" ? first : undefined;
  } else {
    requestedFileRaw = undefined;
  }

  const descriptionParam = req.query.description;
  let description: string | undefined;
  if (typeof descriptionParam === "string") {
    description = descriptionParam;
  } else if (Array.isArray(descriptionParam)) {
    const [first] = descriptionParam;
    description = typeof first === "string" ? first : undefined;
  }

  const sanitizedFile = sanitizeRequestedFile(requestedFileRaw);
  const resolvedPath = path.resolve(dataDir, sanitizedFile);

  logger.info("Upload request received", {
    requestedFile: requestedFileRaw,
    sanitizedFile,
    resolvedPath,
    description,
    contentLength: req.headers["content-length"],
  });

  if (
    resolvedPath !== dataDir &&
    !resolvedPath.startsWith(`${dataDir}${path.sep}`)
  ) {
    logger.warn("Rejected upload outside of data directory", {
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
    // Ensure data directory exists
    await fs.mkdir(dataDir, { recursive: true });

    // Get the binary data from the request body
    const fileData = req.body;
    if (!Buffer.isBuffer(fileData) && !(fileData instanceof Uint8Array)) {
      logger.warn("Invalid upload data format", {
        type: typeof fileData,
        isBuffer: Buffer.isBuffer(fileData),
      });
      res.status(400).json({
        error: "Invalid file data",
        detail: "Request body must contain binary file data",
      });
      return;
    }

    const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData);
    const sizeBytes = buffer.length;

    if (sizeBytes === 0) {
      logger.warn("Empty file upload rejected");
      res.status(400).json({
        error: "Empty file",
        detail: "Cannot upload empty files",
      });
      return;
    }

    // Write the file
    await fs.writeFile(resolvedPath, buffer);

    const stat = await fs.stat(resolvedPath);

    logger.info("File uploaded successfully", {
      file: resolvedPath,
      sizeBytes: stat.size,
      description,
    });

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      filename: sanitizedFile,
      sizeBytes: stat.size,
      readableSize: formatBytes(stat.size),
      description,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    logger.error("Error uploading file", {
      error: message,
      attemptedPath: resolvedPath,
    });
    res.status(500).json({
      error: "Failed to upload file",
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
