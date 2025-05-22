# XMTP Notifications Testing Suite

This manual test suite validates push notification functionality across different XMTP clients and platforms, ensuring proper notification delivery and handling.

## 🎯 Purpose

- Validate push notification delivery across platforms
- Test notification content accuracy and formatting
- Verify notification settings and preferences
- Ensure proper notification lifecycle management

## 🚀 Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
```

## 🔧 Configuration

Create a `.env` file in the root directory:

```bash
LOGGING_LEVEL=info  # Options: debug, info, warn, error, off
XMTP_ENV=production  # Options: production, dev

# Push notification service configuration
PUSH_SERVER_URL=""
NOTIFICATION_API_KEY=""

# Test worker configuration
# Additional workers will be auto-populated during testing
```

## 🏃‍♂️ Test Execution

```bash
yarn test notifications
```

## 📋 Test Flow

1. **Client Setup**:

   - Initializes test workers with notification capabilities
   - Configures push notification services

2. **Notification Registration**:

   - Registers clients for push notifications
   - Validates registration success

3. **Message Trigger Testing**:

   - Sends messages to trigger notifications
   - Verifies notification delivery timing

4. **Content Validation**:

   - Checks notification content accuracy
   - Validates message preview formatting

5. **Preference Testing**:
   - Tests notification preference settings
   - Validates mute/unmute functionality

## ⚠️ Manual Verification Requirements

This test suite requires manual verification of:

- **Visual Notifications**: Actual notification appearance on devices
- **Sound/Vibration**: Audio and haptic feedback validation
- **Timing**: Real-time delivery verification
- **Platform-Specific**: iOS/Android/Web notification behavior

## 📊 Test Scenarios

### Basic Notification Flow

- Direct message notifications
- Group message notifications
- First message notifications

### Advanced Scenarios

- Notification batching
- Rate limiting behavior
- Offline notification queuing
- Cross-platform consistency

### Edge Cases

- Large message content
- Special characters and emojis
- Network interruption during delivery
- Multiple device notifications

## 🐛 Known Issues

- Platform-specific notification delays
- Notification content truncation on some devices
- Background app state affecting delivery

## 🔍 Troubleshooting

### Common Issues

**Notifications not appearing:**

- Check device notification permissions
- Verify push service configuration
- Confirm app background execution settings

**Delayed notifications:**

- Check network connectivity
- Verify push service status
- Test on different networks

**Incorrect content:**

- Validate message encoding
- Check character set support
- Verify content truncation rules

## 📚 Related Documentation

- [Push Notification Architecture](../../../docs/notifications.md)
- [XMTP Client Configuration](../../../docs/client-setup.md)
- [Platform-Specific Guidelines](../../../docs/platform-guide.md)

## 🤝 Contributing

When updating notification tests:

1. Test across multiple platforms
2. Document platform-specific behaviors
3. Include manual verification steps
4. Update test scenarios for new features
