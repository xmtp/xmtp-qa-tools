# 🐛 Bug Report

Wallet Addresses with conflicts:

```bash
0x1c541A1c11095aa7b36Cf138922Da1bF6a6bD54c

0x95484cb08200C26F69131CD5cb5a1b3acb0FAa30

0x1dd038E110b53152af9491cf490C36B1cC720dAa
```

## Reproduce

### Fails in xmtp to create group in xmtp chat with only 2

![](./image.png)

### Fails to create with 3 wallets

![](./image-1.png)

### Fails in convos it hangs

![](./image-2.png)

### Random failures in node 20

![](./image-3.png)

## Description

```bash
git clone https://github.com/xmtp/xmtp-qa-testing/
cd xmtp-qa-testing
yarn
yarn test bug_installation
```

## Test code

- Test [code](./test.test.ts)

### Logs

- [libxmtp](./libxmtp.log) log
- [test logs](./test.log) log

### Environment

- [./data](/.data/) folder
- [.env](/.env) file
