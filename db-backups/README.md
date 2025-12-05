# XMTP DB Backup Server

A simple web server for uploading, downloading, and managing database backups. The server provides a web interface to view available backups and download them, as well as API endpoints for programmatic access.

# 1. SSH into the server

```bash
railway ssh
```

# 2. Upload a backup

To upload a backup (compressing the `/data` folder and `.env` file if it exists):

```bash
FILENAME="${RAILWAY_SERVICE_NAME:-data-backup}.tar.gz"
tar -czf "$FILENAME" ./data $(test -f .env && echo .env)
curl -X POST --data-binary @"$FILENAME" \
  "https://xmtp-agent-db-backup-server.up.railway.app/upload?description=My-db&filename=$FILENAME"
```

# 3. Download a backup

Go to https://xmtp-agent-db-backup-server.up.railway.app and download the backup you want. You can also use the API endpoint to download a backup.
