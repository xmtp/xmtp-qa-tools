# 🐛 Bug Report

Get apps to be in a stitch state where they are talking in different unsynced dms.

1- Create a Dm conversation from node
2- send a dm
3- Remove installation
4- Create a new Dm conversation from node
5- send a dm
6- Notice that the messages are not in the received messages list

## Description

```bash
git clone https://github.com/xmtp/xmtp-qa-testing/
cd xmtp-qa-testing
yarn
yarn test bug_dms_stitch
```

## Test code

- Test [code](./test.test.ts)

### Environment

- [./data](/.data/) folder
- [.env](/.env) file
