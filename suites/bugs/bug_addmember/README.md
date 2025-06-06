## 🐛 Group Member Addition Bug

• **Repro**:

- Create group with Node.js + XMTP Chat users
- Add new Node.js member
- New member only uses `conversation.stream()` before being added
- Stream never receives the group conversation but an error `create group from welcome: welcome with cursor`

• **Works**: All Node.js users only ✅
• **Fails**: Mixed Node.js + XMTP Chat users ❌

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
