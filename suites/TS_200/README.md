# XMTP Large Group Testing Suite (TS_200)

This test suite focuses on creating and managing large groups in XMTP with up to 200 participants to verify scalability and performance with high member counts.

## Test Environment

- **Client**: Single worker "henry" responsible for group management
- **Group Size**: Up to 185 participants (configured via GROUP_SIZE constant)
- **Persistence**: Group ID is saved to environment variables for subsequent test runs

## Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Configuration

Create a `.env` file in the root directory with your testing configuration:

```bash
LOGGING_LEVEL=off  # Options: debug, info, warn, error, off
XMTP_ENV=production  # Options: production, dev
```

## Test Execution

```bash
yarn test 200
```

## Test Flow

1. **Group Creation**:

   - Checks if a group ID already exists in the environment
   - If not, creates a new group with up to 200 participants using generated inboxes
   - Saves the group ID to the .env file for future test runs

2. **Member Management**:
   - Adds specified Convos usernames to the group
   - Tests removing and re-adding batch of 10 members

## Performance Metrics

- Group creation time for large member counts
- Member addition/removal operation timing
- Synchronization performance after membership changes

## Key Features Tested

- Creating groups with a large number of participants (approaching maximum limits)
- Persisting group IDs between test runs for long-term testing
- Adding members to existing large groups
- Removing and re-adding members to test membership management at scale
- Performance and timing metrics for large group operations

## Environment Variables

- `200_PERSON_GROUP_ID_${XMTP_ENV}`: Stores the created group ID for reuse in future test runs
