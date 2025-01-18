<div align="center">

![Release](https://img.shields.io/website/http/huggingface.co/docs/smolagents/index.html.svg?down_color=red&down_message=offline&up_message=online)
[![MIT License](https://img.shields.io/github/license/ephemerahq/xmtp-agents)](https://github.com/ephemerahq/xmtp-agents/blob/main/LICENSE)
[![Number of GitHub stars](https://img.shields.io/github/stars/ephemerahq/message-kit?logo=github)](https://github.com/ephemerahq/message-kit)

<img src="../../media/logo.png" alt="Logo" width="60" />

# @xmtp/resolver

A convenient TypeScript wrapper around [@xmtp/node-sdk](https://github.com/xmtp/xmtp-js/tree/main/sdks/node-sdk) simplifying agent delopment.

</div>

The resolver library provides tools for resolving identities to EVM addresses and keeping track of them in a cache

## Install

```bash [yarn]
yarn add @xmtp/resolver
```

## Overview

```typescript
import { resolve } from "@xmtp/resolver";

// Because user identifiers come in all shapes and sizes!
const identifier = "vitalik.eth"; // Could also be "0x123...", "@fabri", or even a website
const info = await resolve(identifier);

console.log(info);
/*
{
  ensDomain: 'vitalik.eth',
  address: '0x1234...',
  preferredName: 'vitalik.eth',
  converseUsername: '',
  avatar: 'https://...',
  converseEndpoint: ''
}
*/
```

## Supported identifiers

- **Ethereum Addresses** : Example: `0x1234...`
- **ENS Domains** : Example: `vitalik.eth`
- **Converse Usernames** : Example: `@fabri`
- **Inbox ID** : Example: `0x1234...` (Converse inbox ID)
- **Website TXT Record** : Example: `https://example.com` containing `xmtp=0x1234...`
- **Website Header Tag** : Example: `meta="xmtp" content="0x1234..."`

### Returned UserInfo

The resolver always returns a `UserInfo` object with these fields:

| Field                | Description                                |
| -------------------- | ------------------------------------------ |
| **ensDomain**        | The user’s ENS domain (if any)             |
| **address**          | The Ethereum address                       |
| **preferredName**    | Best name to display                       |
| **converseUsername** | The user’s Converse username (if any)      |
| **avatar**           | URL of the user’s profile picture (if any) |
| **converseEndpoint** | Endpoint for the user’s Converse profile   |

## Cache

Skip the repeated lookups—use the built-in cache to store user data. Clear it whenever you need a fresh slate:

```typescript
import { cache } from "@xmtp/resolver";

// Clear the entire cache:
cache.clear();

// Clear a specific address from the cache:
cache.clear("0x1234...");
```

This makes repeated lookups lightning-fast, so you can focus on building cool stuff instead of waiting on network calls.
