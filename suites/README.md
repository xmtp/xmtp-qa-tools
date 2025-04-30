# XMTP Test Suites Documentation

This document provides a comprehensive overview of the XMTP testing infrastructure, organized by test suites and their monitoring dashboards.

## Introduction

The XMTP QA testing framework consists of several specialized test suites designed to evaluate different aspects of the XMTP network's functionality, performance, and reliability. Each suite focuses on specific testing scenarios:

- **TS_Performance**: Measures operational performance and scalability across various XMTP functions
- **TS_Delivery**: Verifies message delivery reliability and correctness across multiple streams
- **TS_Gm**: Tests basic messaging functionality and cross-version compatibility
- **TS_Fork**: Investigates group conversation forking issues through membership manipulation
- **TS_Stress**: Evaluates system behavior under high load conditions
- **TS_Speed**: Focuses on network and operation speed metrics
- **TS_200**: Basic functionality tests ensuring core features work correctly

All test suites provide metrics to monitoring dashboards and can be executed both manually and through automated CI/CD workflows.
