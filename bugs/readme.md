# Reporting bugs

If the test case contains "bug" then its /data folder will default to the bugs test case folder. (Will create if doesnt exist)

To lock env file in bugs use

```tsx
dotenv.config({
  path: path.resolve(process.cwd(), `tests/${testName}/.data/.env`),
});
```

An account with many installs

```bash
# Key package error in xmtp chat (save for later)
ENCRYPTION_KEY_BUG=d7df4be2c5a77c8fe6034f76137b470f997757e5d5b237dfe49f0d66a14d8185
WALLET_KEY_BUG=0xed8abf6c3222b6483f6f55971754cacd7370438b776048cd84b84f5dae0683bc
# public key 0xc9925662D36DE3e1bF0fD64e779B2e5F0Aead964
```
