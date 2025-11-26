# XMTP DB Backup Server

A simple web server for uploading, downloading, and managing database backups. The server provides a web interface to view available backups and download them, as well as API endpoints for programmatic access.

> [!NOTE]  
> This guide assumes you are deploying to Railway in the `/app/data` folder using this [tutorial](https://docs.xmtp.org/agents/deploy/deploy-agent)

## Quick Start

### 1. Install Railway CLI

Install the Railway CLI globally:

```bash
npm i -g @railway/cli
```

Then log in:

```bash
railway login
```

### 2. Deploy to Railway

1. Clone the repository:

   ```bash
   git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools.git
   cd xmtp-qa-tools
   ```

2. Initialize a Railway project:

   ```bash
   railway init
   ```

3. In the Railway dashboard, open your service settings and set the **Start Command** to `yarn download-server`. This ensures Railway runs the web server entrypoint after each deploy.

4. The server will be available on port `8080` (or the port specified by the `PORT` environment variable).

## Usage

### Upload Backups

To upload a backup (compressing the `/data` folder and optionally `.env` file if it exists):

```bash
FILENAME="${RAILWAY_SERVICE_NAME:-data-backup}.tar.gz" && \
tar -czf "$FILENAME" ./data $([ -f .env ] && echo .env) && \
curl -X POST --data-binary @"$FILENAME" \
  "https://xmtp-agent-db-backup-server.up.railway.app/upload?description=My-db&filename=$FILENAME"
```

This command will:

- Use `RAILWAY_SERVICE_NAME` environment variable for the filename (defaults to `data-backup` if not set)
- Include `.env` in the archive only if it exists
- Upload the compressed file to the Railway server

**Note:** Replace `https://xmtp-agent-db-backup-server.up.railway.app` with your own Railway deployment URL.

### Download Backups

Visit the web interface at your server URL (e.g., `http://localhost:8080` or your Railway deployment URL) to:

- View all available backup files
- Download files directly from the web interface
- Delete files (with confirmation)

### API Endpoints

- `GET /` - Web interface showing all available backups
- `GET /download?file=<filename>` - Download a specific file
- `POST /upload?filename=<filename>&description=<description>` - Upload a new backup file
- `DELETE /delete?file=<filename>` - Delete a backup file

## Development

### Run Locally

Start the download server locally:

```bash
yarn download-server
```

The server will start on port `8080` (or the port specified by the `PORT` environment variable).

### Environment Variables

- `PORT` - Port number for the server (default: `8080`)
- The server expects backups to be stored in `/app/data` directory (or the directory specified by the code)

## Features

- 📁 Web interface to browse and download backups
- 📤 Upload backups via API
- 🗑️ Delete backups with confirmation
- 📊 File size and metadata display
- 🔒 Path sanitization for security
- 📝 Detailed logging with Winston
