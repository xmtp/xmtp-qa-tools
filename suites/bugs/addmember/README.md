## 🐛 Group Member Addition Bug

• **Repro**:

Repro test

- Create group with with an [xmtp.chat](https://xmtp.chat/conversations/5ef738ad0a9b61bcc294a3bf621779e6) user
- Start new node member with `conversation.stream()`
- Add member on the already created group

Other:

- Only happens with `addMember` , not `newGroup`
- Doesn't happen in node-only
- Happens when the member is added from browser or RN
- Happens with 2 xmtp chat windows opened

## Description

```bash
# Installation For a faster download with just the latest code
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn
yarn test bug_addmember
```

## Test code

- Test [code](./test.test.ts)

### Logs

- [libxmtp](./libxmtp.log) log
