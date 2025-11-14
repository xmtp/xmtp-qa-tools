# Local database backup

This guide walks you through cloning the repository, deploying the download
server to Railway, and accessing the backups listing on port `8080`.

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

3. Deploy the download server:

   ```bash
   railway up
   ```

## 4. Configure the download server port

Railway automatically assigns the `PORT` environment variable. No additional
configuration is required, but the server listens on port `8080` by default, so
ensure that the service’s **Exposed Port** in the Railway dashboard is set to
`8080`.

If you need to override the port, set the `PORT` environment variable in
Railway:

```bash
railway variables set PORT=8080
```

## 5. Upload backup files

Place backup archives in the service’s mounted volume at `/app/data`. Any files
in that directory will appear in the download table.

## 6. Access the download page

Once the deployment finishes, open the Railway service URL in your browser:

```
https://<your-service>.up.railway.app/
```

You should see the “Download Backup” page with a list of files and their sizes.
Click any **Download** button to retrieve the selected file.
