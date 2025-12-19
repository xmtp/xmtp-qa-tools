# XMTP SDK 5.0.0-rc1 Upgrade Notes

## Overview
Upgraded from node-sdk 4.5.0 (bindings 1.6.0) to node-sdk 5.0.0-rc1 (bindings 1.7.0-rc2)

## Key API Changes in SDK 5.0.0-rc1

### 1. Conversation.send() Method Signature Changed
- **Old (4.x)**: `send(content: ContentTypes, contentType?: ContentTypeId): Promise<string>`
- **New (5.0.0)**: `send(encodedContent: EncodedContent, sendOptions?: SendMessageOpts): Promise<string>`

**Impact**: `send()` no longer accepts plain strings. You must use helper methods or encode content first.

### 2. New Helper Methods
SDK 5.0.0 introduces convenient helper methods on Conversation:
- `sendText(text: string, optimistic?: boolean): Promise<string>`
- `sendMarkdown(markdown: string, optimistic?: boolean): Promise<string>`
- `sendReaction(reaction: Reaction, optimistic?: boolean): Promise<string>`
- `sendReadReceipt(optimistic?: boolean): Promise<string>`
- `sendReply(reply: Reply, optimistic?: boolean): Promise<string>`
- `sendTransactionReference(...): Promise<string>`
- `sendWalletSendCalls(...): Promise<string>`
- `sendActions(...): Promise<string>`
- `sendIntent(...): Promise<string>`
- And more...

### 3. Stream Callbacks Return Type Changed
- **Old (4.x)**: Callbacks received `DecodedMessage`
- **New (5.0.0)**: Callbacks receive `Message | DecodedMessage`

**Impact**: Need to check if message is decoded before accessing properties like `contentType`, `conversationId`, `sentAt`

## Compatibility Layer

Created `helpers/sdk-compat.ts` with backward compatibility utilities:

### sendTextCompat()
Sends text messages compatible with both SDK 4.x and 5.0+
```typescript
export const sendTextCompat = async (
  conversation: any,
  text: string,
): Promise<string> => {
  if (typeof conversation.sendText === "function") {
    return await conversation.sendText(text);  // SDK 5.0+
  } else if (typeof conversation.send === "function") {
    return await conversation.send(text);      // SDK 4.x
  }
  throw new Error("Conversation does not have send or sendText method");
};
```

### isDecodedMessage()
Type guard to check if a message is fully decoded:
```typescript
export const isDecodedMessage = (message: any): message is DecodedMessage => {
  return (
    message &&
    typeof message === "object" &&
    "contentType" in message &&
    "conversationId" in message &&
    "sentAt" in message
  );
};
```

## Files Modified

### Core Changes
- `package.json`: Updated to include node-sdk-5.0.0 and node-bindings-1.7.0-rc2
- `helpers/versions.ts`: Added SDK 5.0.0 to version list, made it the default
- `helpers/sdk-compat.ts`: **NEW** - Compatibility layer for SDK 4.x and 5.0.0
- `helpers/client.ts`: Updated to use sendTextCompat

### Worker Files
- `workers/main.ts`: Added type guards for stream callbacks, updated send calls

### Test Files (Updated to use sendTextCompat)
- `cli/blast.ts`
- `monitoring/performance.test.ts`
- `monitoring/delivery.test.ts`
- `monitoring/browser/browser.test.ts`
- `monitoring/bugs/402restart.test.ts`
- `monitoring/bugs/stitch.test.ts`
- `monitoring/networkchaos/*.test.ts` (all files)
- `measurements/perf-matrix.test.ts`
- `helpers/streams.ts`
- `forks/forks.test.ts`

### Agent Files
All agent handlers already use the Agent SDK which provides helper methods like `ctx.sendText()`, so minimal changes needed.

## D14N Support Merged
Merged changes from `hypernova/d14n2` branch which adds:
- D14N mode environment variable support (`XMTP_D14N=true`)
- Gateway host configuration via `d14nHost` parameter (SDK 5.0.0+) or `apiUrl` (SDK 4.x)
- Updated `.env.example` with D14N configuration options

## Testing Recommendations

1. **Basic Messaging**: Test send/receive in DMs and groups
2. **Stream Callbacks**: Verify message streams work correctly
3. **Content Types**: Test reactions, replies, attachments, etc.
4. **D14N Mode**: Test with D14N gateway if applicable
5. **Multi-Version**: Test with NODE_VERSION env var to verify backward compatibility

## Migration Guide for Other Projects

If you're upgrading another project to SDK 5.0.0-rc1:

1. Update package.json dependencies
2. Copy `helpers/sdk-compat.ts` to your project
3. Replace all `conversation.send(stringMessage)` with `sendTextCompat(conversation, stringMessage)`
4. Update stream callbacks to handle `Message | DecodedMessage`:
   ```typescript
   onValue: (message: any) => {
     if (isDecodedMessage(message)) {
       // Safe to access message.contentType, message.conversationId, etc.
     }
   }
   ```
5. For new projects, use the new helper methods directly: `conversation.sendText(message)`

## Known Issues

None at this time. The compatibility layer ensures backward compatibility with SDK 4.x codebases.

## References

- [XMTP SDK Update Documentation](https://docs.xmtp.org/fund-agents-apps/update-sdk)
- [XMTP V3 Upgrade Guide](https://docs.xmtp.org/upgrade-from-legacy-V3)

