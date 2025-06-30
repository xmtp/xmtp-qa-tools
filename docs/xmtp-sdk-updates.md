# XMTP SDK Update Automation

This project includes automated tooling to keep the XMTP Node SDK dependencies up to date while maintaining backward compatibility by storing multiple versions.

## How It Works

The project stores multiple versions of the XMTP SDK using npm aliases following this pattern:

- **Main dependency**: `@xmtp/node-sdk` (latest version)
- **Versioned aliases**: `@xmtp/node-sdk-XXX` where XXX is the version without dots (e.g., `301` for version `3.0.1`)
- **Corresponding bindings**: `@xmtp/node-bindings-XXX` following the same pattern
- **Package extensions**: Ensure compatibility between SDK and bindings versions

## Automated Updates

### GitHub Workflow

The repository includes a GitHub workflow (`.github/workflows/update-xmtp-sdk.yml`) that:

1. **Runs daily at 9 AM UTC** to check for new versions
2. **Can be triggered manually** via GitHub Actions UI
3. **Automatically creates PRs** when new versions are available
4. **Follows the existing versioning pattern** for aliases
5. **Includes compatibility checks** and package extensions

#### What the workflow does:

1. Checks npm for the latest `@xmtp/node-sdk` version
2. Compares it with the current version in `package.json`
3. If a new version is found:
   - Creates a new branch `update/xmtp-sdk-X.Y.Z`
   - Updates the main dependency to the new version
   - Adds a versioned alias following the existing pattern
   - Determines and adds the corresponding `@xmtp/node-bindings` version
   - Adds package extensions for compatibility
   - Runs a build test to verify compatibility
   - Creates a PR with detailed changelog and migration notes
   - Adds appropriate labels (`dependencies`, `automated`, `xmtp-sdk`)

#### Manual triggering:

1. Go to the **Actions** tab in GitHub
2. Select **"Update XMTP Node SDK"** workflow
3. Click **"Run workflow"**
4. Choose the branch (usually `main`) and click **"Run workflow"**

### PR Review Process

When the automated PR is created:

1. **Review the changes** in `package.json`
2. **Check the release notes** linked in the PR description
3. **Run tests locally** to ensure compatibility
4. **Look for breaking changes** that might require code updates
5. **Merge when ready** or request changes if issues are found

## Manual Updates

### Using npm scripts

```bash
# Check for available updates
yarn check-updates:xmtp

# Update to the latest version
yarn update:xmtp
```

### Using the update script directly

```bash
# Check for updates only
node scripts/update-xmtp-sdk.js --check

# Update to latest version
node scripts/update-xmtp-sdk.js --update

# Update to a specific version
node scripts/update-xmtp-sdk.js --version=3.1.0 --update
```

### Script options:

- `--check`: Check for updates without making changes
- `--update`: Perform the update (install dependencies and run tests)
- `--version=X.Y.Z`: Update to a specific version
- `--help`: Show help message

## Version Management

### Current versioning pattern:

```json
{
  "dependencies": {
    "@xmtp/node-sdk": "3.0.1",
    "@xmtp/node-sdk-105": "npm:@xmtp/node-sdk@1.0.5",
    "@xmtp/node-sdk-209": "npm:@xmtp/node-sdk@2.0.9",
    "@xmtp/node-sdk-210": "npm:@xmtp/node-sdk@2.1.0",
    "@xmtp/node-sdk-220": "npm:@xmtp/node-sdk@2.2.1",
    "@xmtp/node-sdk-300": "npm:@xmtp/node-sdk@3.0.1"
  },
  "packageExtensions": {
    "@xmtp/node-sdk@3.0.1": {
      "dependencies": {
        "@xmtp/node-bindings": "1.2.5"
      }
    }
  }
}
```

### Using specific versions in code:

```typescript
// Use the latest version (default)
import { Client } from "@xmtp/node-sdk";

// Use a specific version via alias
import { Client } from "@xmtp/node-sdk-209"; // Uses version 2.0.9
```

## Troubleshooting

### Update fails with build errors

1. Check the [release notes](https://github.com/xmtp/xmtp-node-js-sdk/releases) for breaking changes
2. Look for migration guides in the XMTP documentation
3. Update your code to use the new API if needed
4. Consider pinning to the previous version temporarily

### Workflow fails to create PR

1. Check the [workflow runs](../../actions/workflows/update-xmtp-sdk.yml) for error details
2. Common issues:
   - Network timeouts when checking npm
   - Permission issues with creating branches/PRs
   - Merge conflicts with existing update branches

### Manual intervention needed

If the automated update fails or needs special handling:

1. Run the manual update script with specific version
2. Manually fix any compatibility issues
3. Update the workflow if patterns change
4. Create PR manually with the changes

## Configuration

### Workflow schedule

To change the update frequency, edit `.github/workflows/update-xmtp-sdk.yml`:

```yaml
on:
  schedule:
    # Change this cron expression to adjust frequency
    # Current: Daily at 9 AM UTC
    - cron: '0 9 * * *'
```

### Common cron expressions:

- `0 9 * * *` - Daily at 9 AM UTC
- `0 9 * * 1` - Weekly on Monday at 9 AM UTC  
- `0 9 1 * *` - Monthly on the 1st at 9 AM UTC

### Notification settings

The workflow will:
- Create an issue if the update process fails
- Add labels to PRs for easy filtering
- Include detailed information in PR descriptions

## Best Practices

1. **Review all automated PRs** before merging
2. **Test thoroughly** after updating, especially for major version changes
3. **Keep old versions** available for compatibility testing
4. **Monitor the XMTP releases** for important security updates
5. **Update promptly** for security patches
6. **Use manual updates** for urgent fixes that can't wait for the scheduled run

## Related Files

- `.github/workflows/update-xmtp-sdk.yml` - Automated workflow
- `scripts/update-xmtp-sdk.js` - Manual update script
- `package.json` - Dependency configuration
- This file: `docs/xmtp-sdk-updates.md` - Documentation