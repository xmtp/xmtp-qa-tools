# Local db backups in railway

This guide walks you through cloning the repository, deploying the download
server to Railway, and accessing the backups listing on port `8080`.

> [!NOTE]  
> THis guides assumes you are deploying to Railway in the /app/data folder using this [tutorial](https://docs.xmtp.org/agents/deploy/deploy-agent)

## Upload backups to our own server

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

## Development

1. Start the download server locally

## 1. Clone the project

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools.git
cd xmtp-qa-tools
```

## 2. Deploy to Railway

1. Install the Railway CLI and log in:

   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. Create a Railway project:

   ```bash
   railway init
   ```

3. In the Railway dashboard, open your service settings and set the **Start
   Command** to `yarn download-server`. This ensures Railway runs the web server entrypoint
   after each deploy.
