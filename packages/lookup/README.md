# Lookup library

The lookup library provides tools for resolving identities to EVM addresses and keeping track of them in a cache

## Install

```bash [yarn]
yarn add @xmtp/lookup
```

## Overview

```typescript
import { lookup } from "@xmtp/lookup";

// Because user identifiers come in all shapes and sizes!
const identifier = "vitalik.eth"; // Could also be "0x123...", "@fabri", or even a website
const info = await lookup(identifier);

console.log(info);
/*
{
  ensDomain: 'vitalik.eth',
  address: '0x1234...',
  preferredName: 'vitalik.eth',
  converseUsername: '',
  avatar: 'https://...',
  converseEndpoint: 'https://converse.xyz/...'
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

The lookup always returns a `UserInfo` object with these fields:

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
import { cache } from "@xmtp/lookup";

// Clear the entire cache:
cache.clear();

// Clear a specific address from the cache:
cache.clear("0x1234...");
```

This makes repeated lookups lightning-fast, so you can focus on building cool stuff instead of waiting on network calls.
