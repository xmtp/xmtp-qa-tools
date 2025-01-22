# Lookup library

The Lookup module provides a utility function to resolve various types of identifiers to their corresponding addresses or domains. This includes ENS names, reverse ENS lookups, website URLs, and Converse usernames.

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

The lookup always returns a `UserInfo` object with these fields:

| Field                | Description                                |
| -------------------- | ------------------------------------------ |
| **ensDomain**        | The user’s ENS domain (if any)             |
| **address**          | The Ethereum address                       |
| **preferredName**    | Best name to display                       |
| **converseUsername** | The user’s Converse username (if any)      |
| **avatar**           | URL of the user’s profile picture (if any) |
| **converseEndpoint** | Endpoint for the user’s Converse profile   |

Certainly! Here's the README content without code block separators:

## Usage

Below are examples of how to use the `lookup` function in different scenarios.

### Install

```bash [yarn]
yarn add @xmtp/lookup
```

### ENS lookup

To resolve an ENS name to an Ethereum address:

```tsx
import { lookup } from "@your-package/lookup";

async function resolveENS() {
  const data = await lookup("vitalik.eth");
  console.log(data?.address?.toLowerCase()); // Outputs: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
}
```

### ENS reverse lookup

To resolve an Ethereum address to an ENS domain:

```tsx
async function reverseENS() {
  const data = await lookup("0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204");
  console.log(data?.ensDomain?.toLowerCase()); // Outputs: humanagent.eth
}
```

### Website lookup

To resolve a website URL to an Ethereum address:

```tsx
async function resolveWebsite() {
  const data = await lookup("https://messagekit.ephemerahq.com/");
  console.log(data?.address?.toLowerCase()); // Outputs: 0x93e2fc3e99dfb1238eb9e0ef2580efc5809c7204
}
```

### Converse username lookup

To resolve a Converse username to an Ethereum address:

```tsx
async function resolveConverseUsername() {
  const data = await lookup("@fabri");
  console.log(data?.address?.toLowerCase()); // Outputs: 0x93e2fc3e99dfb1238eb9e0ef2580efc5809c7204
}
```

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
