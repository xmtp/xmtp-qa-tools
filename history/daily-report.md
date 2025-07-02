# XMTP QA Daily Report - Wed Jul 02 2025

## 📊 Executive Summary

- **Total Issues Analyzed**: 33
- **Performance Issues**: 2
- **Agent Issues**: 11
- **Environment Split**: Dev: 11, Production: 22

## 🚨 Critical Issues

### Performance Timeouts

- **Count**: 2 timeout issues
- **Average Duration**: 10.0s
- **Max Duration**: 10s

### Agent Response Issues

- **carl**: 1 timeouts (avg: 20.0s)
- **mike**: 1 timeouts (avg: 20.0s)
- **adam**: 1 timeouts (avg: 20.0s)
- **mary**: 1 timeouts (avg: 20.0s)
- **victor**: 1 timeouts (avg: 20.0s)
- **ursula**: 1 timeouts (avg: 20.0s)
- **bob**: 2 timeouts (avg: 20.0s)
- **lisa**: 1 timeouts (avg: 20.0s)
- **xavier**: 1 timeouts (avg: 20.0s)
- **julia**: 1 timeouts (avg: 20.0s)

## 🧪 Test Suite Status

- **browser**: 16 issues 🔴 High
- **agents**: 11 issues 🔴 High
- **functional**: 3 issues 🟢 Low
- **performance**: 2 issues 🟢 Low
- **large**: 1 issues 🟢 Low

## 🔍 Common Failure Patterns

- **conversation stream for new member** (18x)
- **production: byte : 0xdfc00a0B28Df3c07b0942300E896C97d62014499** (8x)
- **newGroup and message stream** (7x)
- **newDm and message stream** (6x)
- **dev: key-check : 0x235017975ed5F55e23a71979697Cd67DcAE614Fa** (3x)
- **dev: csx : 0x74563b2e03f8539ea0ee99a2d6c6b4791e652901** (3x)
- **dev: gang : 0x6461bf53ddb33b525c84bf60d6bb31fa10828474** (3x)
- **should receive conversation with async** (3x)
- **receiveGroupMessage-100: should create a group and measure all streams** (2x)
- **conversation stream with message** (1x)

## 💡 Recommendations

- **Agents**: Monitor agent response times, consider timeout adjustments

---

_Report generated on 2025-07-02T19:31:24.245Z_
_Data source: history/issues.json (33 total entries)_
