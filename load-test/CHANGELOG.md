# Changelog

All notable changes to the XMTP Load Test framework will be documented in this file.

## [1.0.0] - 2024-12-04

### Added

#### Core Framework
- **Artillery-based load testing**: Full-featured load test framework using Artillery.io
- **Simple TypeScript runner**: Alternative lightweight test runner for debugging
- **Setup script**: Automated creation of test identities and groups
- **Build system**: Cross-platform build scripts for Artillery processor

#### Configuration & Customization
- **Flexible load profiles**: Configure identities, groups, members, concurrency, and duration
- **Multiple test phases**: Support for warm-up, sustained load, and cool-down phases
- **Worker pool management**: Configurable parallelism for high throughput
- **Environment support**: Works with XMTP dev and production environments

#### Analysis & Reporting
- **Artillery HTML reports**: Detailed performance reports with graphs
- **Custom analytics**: Script to analyze throughput, latency, and success rates
- **Real-time metrics**: Live progress tracking during tests
- **Time-series analysis**: Rate stability and performance over time

#### Platform Support
- **Cross-platform**: Works on Windows, Linux, and macOS
- **Shell scripts**: Bash scripts for Unix-like systems
- **Batch scripts**: Windows batch files for CMD/PowerShell
- **Node.js scripts**: Pure JavaScript for maximum compatibility

#### Documentation
- **Comprehensive README**: Full setup, usage, and troubleshooting guide
- **Example configurations**: 10+ real-world test scenarios
- **Best practices**: Guidelines for effective load testing
- **Quick start guides**: Interactive setup wizards for both Unix and Windows

#### Files Created
```
load-test/
├── package.json              # Dependencies and scripts
├── README.md                 # Main documentation
├── EXAMPLES.md               # Test scenario examples
├── CHANGELOG.md              # This file
├── tsconfig.json             # TypeScript configuration
├── setup.ts                  # Identity/group setup script
├── artillery-config.yml      # Artillery configuration
├── artillery-processor.ts    # Message sending logic
├── build-processor.js        # Cross-platform build script
├── build.sh                  # Unix build script
├── build.bat                 # Windows build script
├── run-simple.ts             # Simple test runner
├── analyze.ts                # Results analysis script
├── quick-start.sh            # Unix quick-start wizard
├── quick-start.bat           # Windows quick-start wizard
└── .gitignore                # Git ignore rules
```

### Features

#### Scalability
- Supports 5M+ messages per day
- Configurable worker pools
- Distributed load across multiple groups
- Efficient database management per identity

#### Performance
- Real-time throughput monitoring
- Latency tracking (p50, p95, p99)
- Success/error rate tracking
- System resource monitoring

#### Flexibility
- Multiple test runners (Artillery vs Simple)
- Customizable load profiles
- Environment variable support
- Multi-environment testing

#### Developer Experience
- Interactive setup wizards
- Automated build process
- Comprehensive error handling
- Detailed logging and metrics

### Dependencies

#### Core Dependencies
- `@xmtp/agent-sdk`: ^0.0.33
- `artillery`: ^2.0.20
- `commander`: ^12.0.0

#### Development Dependencies
- `tsx`: ^4.7.1
- `@types/node`: ^20.11.19
- `esbuild`: ^0.20.0
- `typescript`: ^5.3.3

### Performance Targets

| Setup  | Messages/Day | Rate (msg/s) |
|--------|--------------|--------------|
| Small  | 2.6M         | 30           |
| Medium | 5.2M         | 60           |
| Large  | 8.6M         | 100          |
| XLarge | 13M          | 150          |

### Known Limitations

1. **Windows Support**: Some shell scripts may not work in Git Bash; use CMD or PowerShell
2. **Memory Usage**: Large-scale tests (200+ identities) require 16GB+ RAM
3. **Database Files**: Each identity creates a separate DB file
4. **Network Dependency**: Requires stable connection to XMTP nodes

### Future Enhancements

Potential improvements for future versions:

- [ ] Docker support for containerized testing
- [ ] Kubernetes deployment configurations
- [ ] Real-time dashboard for monitoring
- [ ] Automatic scaling based on system resources
- [ ] Integration with CI/CD pipelines
- [ ] Support for custom content types
- [ ] Message size variation testing
- [ ] Geographic distribution simulation
- [ ] Advanced failure injection
- [ ] Performance regression detection

### Credits

Built for the XMTP QA Tools repository by the XMTP team.

### License

Same as parent repository (MIT License).

