This test suite validates group conversation stability under high-frequency membership changes and concurrent operations, helping identify forking issues and race conditions in XMTP group conversations.

## Key Files

- chaos.test.ts - Main stress testing implementation
- run.sh - Automated test execution script
- rate-limited.test.ts - Rate limited test implementation
- run-rate-limited.sh - Automated test execution script for rate limited test
- README.md - This documentation
