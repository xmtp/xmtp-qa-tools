# New getWorkers API Usage Examples

This document demonstrates the new `getWorkers` API that consolidates functionality and simplifies the interface.

## Before (Legacy)

```typescript
import {
  getFixedNames,
  getRandomNames,
  getWorkersWithVersions,
} from "@helpers/client";
import { getWorkers } from "@workers/manager";

// Old pattern - required multiple function calls
const descriptors = getWorkersWithVersions(getRandomNames(3));
const workers = await getWorkers(descriptors);

// Or for fixed names
const names = getFixedNames(5);
const workersFixed = await getWorkers(names);
```

## After (New API)

```typescript
import { getWorkerNames, getWorkers } from "@workers/manager";

// New pattern - much cleaner, all options in one call
const workers = await getWorkers(3, undefined, {
  useVersions: true,
  nameMode: "random",
});

// Get names array when needed
const names = getWorkerNames(workers); // ["alice", "bob", "charlie"]
```

## API Signatures

### New getWorkers Function

```typescript
async function getWorkers(
  descriptorsOrMap: string[] | Record<string, string> | number,
  env?: XmtpEnv,
  options?: {
    useVersions?: boolean; // Apply version descriptors (default: false)
    nameMode?: "fixed" | "random"; // Name selection mode (default: 'fixed')
  },
): Promise<WorkerManager>;
```

### New Helper Function

```typescript
function getWorkerNames(workers: WorkerManager): string[];
```

## Usage Examples

### 1. Simple Worker Creation

```typescript
// Create 3 workers with fixed names (alice, bob, fabri)
const workers = await getWorkers(3);

// Create 5 workers with random names
const workers = await getWorkers(5, undefined, { nameMode: "random" });
```

### 2. With Version Testing

```typescript
// Create versioned workers for compatibility testing
const workers = await getWorkers(3, undefined, { useVersions: true });

// Create random versioned workers
const workers = await getWorkers(4, undefined, {
  useVersions: true,
  nameMode: "random",
});
```

### 3. Specific Worker Names

```typescript
// Specify exact worker names (with optional versioning)
const workers = await getWorkers(["alice", "bob", "charlie"], undefined, {
  useVersions: true,
});
```

### 4. API URL Mapping

```typescript
// For distributed testing with different API endpoints
const workers = await getWorkers(
  {
    alice: "https://api1.example.com",
    bob: "https://api2.example.com",
  },
  undefined,
  { useVersions: true },
);
```

### 5. Getting Worker Names

```typescript
const workers = await getWorkers(5, undefined, { nameMode: "random" });
const names = getWorkerNames(workers);
// Returns: ["grace", "tom", "alice", "eve", "charlie"] (example)

// Useful for logging or debugging
console.log(`Created workers: ${names.join(", ")}`);
```

## Migration Guide

### Before and After Comparison

#### Creating Random Workers with Versions

**Before:**

```typescript
import { getRandomNames, getWorkersWithVersions } from "@helpers/client";
import { getWorkers } from "@workers/manager";

const descriptors = getWorkersWithVersions(getRandomNames(2));
const workers = await getWorkers(descriptors);
```

**After:**

```typescript
import { getWorkers } from "@workers/manager";

const workers = await getWorkers(2, undefined, {
  useVersions: true,
  nameMode: "random",
});
```

#### Creating Fixed Workers

**Before:**

```typescript
import { getFixedNames } from "@helpers/client";
import { getWorkers } from "@workers/manager";

const names = getFixedNames(5);
const workers = await getWorkers(names);
```

**After:**

```typescript
import { getWorkers } from "@workers/manager";

const workers = await getWorkers(5); // nameMode: 'fixed' is default
```

#### Getting Worker Names for External Use

**Before:**

```typescript
const names = getRandomNames(3);
const workers = await getWorkers(names);
// names array was available from before worker creation
```

**After:**

```typescript
import { getWorkerNames, getWorkers } from "@workers/manager";

const workers = await getWorkers(3, undefined, { nameMode: "random" });
const names = getWorkerNames(workers); // Get names after creation
```

## Benefits of the New API

1. **Simplified Interface**: One function call instead of multiple
2. **Consolidated Options**: All configuration in one place
3. **Better Type Safety**: Clearer parameter types and validation
4. **Consistent Ordering**: `getWorkerNames()` always returns names in creation order
5. **Backward Compatible**: Old patterns still work (marked as deprecated)

## Deprecation Notes

The following functions are now deprecated but still functional:

- `getWorkersWithVersions()` - Use `useVersions: true` option
- `getRandomNames()` - Use `nameMode: 'random'` option
- `getFixedNames()` - Use `nameMode: 'fixed'` option (default)

These will be removed in a future release.
