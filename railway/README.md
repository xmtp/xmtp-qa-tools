# Local db backups in railway

This guide walks you through cloning the repository, deploying the download
server to Railway, and accessing the backups listing on port `8080`.

> [!NOTE]  
> THis guides assumes you are deploying to Railway in the /app/data folder using this [tutorial](https://docs.xmtp.org/agents/deploy/deploy-agent)

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
   Command** to `yarn web`. This ensures Railway runs the web server entrypoint
   after each deploy.

4. Deploy the download server:

   ```bash
   railway up
   ```

## 3. Access the download page

Once the deployment finishes, open the Railway service URL in your browser:

```
https://<your-service>.up.railway.app/
```

You should see the "Download Backup" page with a list of files and their sizes.
Click any **Download** button to retrieve the selected file.

![Screenshot](./screenshot.png)

## 4. Upload backups

To upload a backup (compressing the `/data` folder and optionally `.env` file if it exists):

```bash
tar -czf data-backup.tar.gz ./data $([ -f .env ] && echo .env) && curl -X POST --data-binary @data-backup.tar.gz \
  "https://backup-server-production-3285.up.railway.app/upload?description=My-db&filename=data-backup.tar.gz"
```

This command will include `.env` in the archive only if it exists. Replace `backup-server-production-3285.up.railway.app` with your Railway service URL.
