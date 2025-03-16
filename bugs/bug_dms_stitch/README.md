# 🐛 Bug Report

Get apps to be in a stitch state where they are talking in different unsynced dms.

0- Open convos or XMTP chat

1- Set the inbox Id of the receiver `destinationInboxId`

2- Run test `yarn test bug_dms_stitch`

- will create a new dm with the `destinationInboxId`
- send a message to the dm
- Remove installation

3- Run again the test `yarn test bug_dms_stitch`

- Create a new Dm conversation from node
- send a dm

> Notice that the messages are not in the received messages list

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
