# XMTP DB Backup Server

A simple web server for uploading, downloading, and managing database backups. The server provides a web interface to view available backups and download them, as well as API endpoints for programmatic access.

# 1. SSH into the server

````bash
railway ssh

# 2. Upload a backup

To upload a backup (compressing the `/data` folder and optionally `.env` file if it exists):

```bash
FILENAME="${RAILWAY_SERVICE_NAME:-data-backup}.tar.gz" && \
tar -czf "$FILENAME" ./data $([ -f .env ] && echo .env) && \
curl -X POST --data-binary @"$FILENAME" \
  "https://xmtp-agent-db-backup-server.up.railway.app/upload?description=My-db&filename=$FILENAME"
````

3. Download a backup

```bash
curl -X GET "https://xmtp-agent-db-backup-server.up.railway.app/download?file=db-backup.tar.gz" -o db-backup.tar.gz
```

4. Delete a backup

```bash
curl -X DELETE "https://xmtp-agent-db-backup-server.up.railway.app/delete?file=db-backup.tar.gz"
```

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
