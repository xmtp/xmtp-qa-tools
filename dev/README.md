# Work in local network

`Dev` and `production` networks are hosted by XMTP, while `local` network is hosted by yourself. Use local network for development purposes only.

- 1. Install docker
- 2. Start the XMTP service and database

```bash
./dev/up
```

- 3. Change the .env file to use the local network

```bash
XMTP_ENV=local
```

- 4. Debug with [xmtp.chat](https://xmtp.chat/)

![](../media/chat.png)
