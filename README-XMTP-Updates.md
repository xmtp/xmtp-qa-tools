# 🚀 XMTP SDK Auto-Update System

Automated solution to keep your XMTP Node SDK dependencies up to date while maintaining backward compatibility.

## ✅ What's Included

### 🤖 Automated GitHub Workflow
- **Daily checks** for new XMTP SDK versions at 9 AM UTC
- **Auto-creates PRs** when updates are available
- **Manual trigger** option via GitHub Actions
- **Smart dependency management** following your existing versioning pattern

### 🛠️ Manual Update Tools
- **CLI script** for local updates and testing
- **Yarn scripts** for easy access
- **Version-specific updates** for targeted upgrades

### 📚 Documentation
- **Complete guide** at `docs/xmtp-sdk-updates.md`
- **Best practices** and troubleshooting tips
- **Configuration options** for customization

## 🚀 Quick Start

### Check for Updates
```bash
yarn check-updates:xmtp
```

### Update to Latest Version  
```bash
yarn update:xmtp
```

### Manual Workflow Trigger
1. Go to **Actions** tab in GitHub
2. Select **"Update XMTP Node SDK"** workflow  
3. Click **"Run workflow"**

## 📋 Files Added

- `.github/workflows/update-xmtp-sdk.yml` - Automated workflow
- `scripts/update-xmtp-sdk.js` - Manual update script  
- `docs/xmtp-sdk-updates.md` - Complete documentation
- Updated `package.json` with new scripts

## 🔧 How It Works

1. **Monitors** npm for new `@xmtp/node-sdk` releases
2. **Creates** versioned aliases following your pattern (e.g., `@xmtp/node-sdk-301`)
3. **Updates** corresponding `@xmtp/node-bindings` dependencies
4. **Adds** package extensions for compatibility
5. **Tests** the build to ensure everything works
6. **Creates PR** with detailed changelog and migration notes

## 🎯 Key Features

- ✅ **Backward compatibility** - keeps old versions available
- ✅ **Smart versioning** - follows your existing alias pattern  
- ✅ **Dependency mapping** - automatically handles node-bindings
- ✅ **Build verification** - tests compatibility before PR creation
- ✅ **Rich PR descriptions** - includes release notes and migration info
- ✅ **Failure handling** - creates issues when automation fails

## 📖 Next Steps

1. **Review** the [complete documentation](docs/xmtp-sdk-updates.md)
2. **Test** the manual script with your current setup
3. **Customize** the workflow schedule if needed
4. **Monitor** for your first automated PR!

---

For detailed information, see the [full documentation](docs/xmtp-sdk-updates.md).