#!/usr/bin/env python3

import os
import re
import subprocess
import glob

def run_git_command(cmd):
    """Run a git command and return the output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        print(f"Error running command: {cmd}")
        print(f"Error: {e}")
        return "", str(e)

def get_conflicted_files():
    """Get list of files with merge conflicts"""
    stdout, stderr = run_git_command("git diff --name-only --diff-filter=U")
    if stdout:
        return stdout.split('\n')
    return []

def resolve_test_file_conflict(filepath):
    """Resolve conflicts in test files by applying the new API pattern"""
    print(f"Resolving conflicts in: {filepath}")
    
    try:
        with open(filepath, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return False
    
    # Remove conflict markers and keep our version (HEAD)
    lines = content.split('\n')
    resolved_lines = []
    in_conflict = False
    keep_section = False
    
    for line in lines:
        if line.startswith('<<<<<<< HEAD'):
            in_conflict = True
            keep_section = True
            continue
        elif line.startswith('======='):
            keep_section = False
            continue
        elif line.startswith('>>>>>>> '):
            in_conflict = False
            continue
        
        if not in_conflict or keep_section:
            resolved_lines.append(line)
    
    resolved_content = '\n'.join(resolved_lines)
    
    # Apply our new API patterns to ensure consistency
    # Replace old getWorkers patterns with new ones
    patterns = [
        # Pattern 1: getWorkers with multiple parameters
        (r'getWorkers\(\s*([^,\)]+),\s*([^,\)]+),\s*typeofStream\.[^,\)]+(?:,\s*typeOfResponse\.[^,\)]+)?(?:,\s*typeOfSync\.[^,\)]+)?(?:,\s*[^,\)]+)?\s*\)', 
         r'getWorkers(\1, \2)'),
        
        # Pattern 2: getWorkers with array and multiple parameters
        (r'getWorkers\(\s*(\[[^\]]+\]),\s*([^,\)]+),\s*typeofStream\.[^,\)]+(?:,\s*typeOfResponse\.[^,\)]+)?(?:,\s*typeOfSync\.[^,\)]+)?(?:,\s*[^,\)]+)?\s*\)',
         r'getWorkers(\1, \2)'),
         
        # Pattern 3: getWorkers with number and multiple parameters
        (r'getWorkers\(\s*(\d+),\s*([^,\)]+),\s*typeofStream\.[^,\)]+(?:,\s*typeOfResponse\.[^,\)]+)?(?:,\s*typeOfSync\.[^,\)]+)?(?:,\s*[^,\)]+)?\s*\)',
         r'getWorkers(\1, \2)'),
    ]
    
    for pattern, replacement in patterns:
        resolved_content = re.sub(pattern, replacement, resolved_content, flags=re.MULTILINE)
    
    # Remove unused imports
    imports_to_remove = ['typeOfResponse', 'typeOfSync']
    for import_name in imports_to_remove:
        # Remove from import statements
        resolved_content = re.sub(f',\s*{import_name}', '', resolved_content)
        resolved_content = re.sub(f'{import_name},\s*', '', resolved_content)
        resolved_content = re.sub(f'import\s*{{\s*{import_name}\s*}}\s*from[^;]+;?\s*\n', '', resolved_content)
    
    try:
        with open(filepath, 'w') as f:
            f.write(resolved_content)
        print(f"Successfully resolved: {filepath}")
        return True
    except Exception as e:
        print(f"Error writing {filepath}: {e}")
        return False

def resolve_guidelines_conflict():
    """Handle the guidelines.md file that was deleted in main"""
    print("Handling .cursor/rules/guidelines.md...")
    # Since it was deleted in main, we'll remove it from our branch too
    run_git_command("git rm .cursor/rules/guidelines.md")
    return True

def resolve_workers_readme_conflict():
    """Handle the workers/README.md file"""
    print("Handling workers/README.md...")
    # This file was deleted in our branch but modified in main
    # We'll keep the main version and then apply our updates
    run_git_command("git add workers/README.md")
    
    # Now update it with our new API patterns
    try:
        with open('workers/README.md', 'r') as f:
            content = f.read()
        
        # Apply our API updates to the main version
        content = re.sub(
            r'getWorkers\(\s*getWorkersWithVersions\(\["alice", "bob"\]\),\s*testName,\s*typeofStream\.Message,\s*\)',
            'getWorkers(["alice", "bob"], testName)',
            content
        )
        
        # Add dynamic stream control section if not present
        if 'Dynamic Stream Control' not in content:
            # Insert our dynamic stream control documentation
            insert_pos = content.find('## Worker Access Patterns')
            if insert_pos > 0:
                dynamic_section = '''
## Dynamic Stream Control

Workers now support dynamic stream control, allowing you to start and stop specific stream types during runtime:

### Starting Streams

```typescript
import { typeofStream } from "@workers/main";

// Start a message stream
worker.worker.startStream(typeofStream.Message);

// Start a message stream with automatic responses
worker.worker.startStream(typeofStream.MessageandResponse);

// Start multiple streams
worker.worker.startStream(typeofStream.Conversation);
worker.worker.startStream(typeofStream.Consent);
```

### Stopping Streams

```typescript
// Stop all streams
worker.worker.endStream();

// Stop a specific stream type
worker.worker.endStream(typeofStream.Message);
```

'''
                content = content[:insert_pos] + dynamic_section + content[insert_pos:]
        
        with open('workers/README.md', 'w') as f:
            f.write(content)
            
        print("Successfully updated workers/README.md")
        return True
    except Exception as e:
        print(f"Error updating workers/README.md: {e}")
        return False

def resolve_manager_conflict():
    """Resolve conflicts in workers/manager.ts"""
    print("Resolving workers/manager.ts...")
    try:
        with open('workers/manager.ts', 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading workers/manager.ts: {e}")
        return False
    
    # Remove conflict markers and keep our version (HEAD)
    lines = content.split('\n')
    resolved_lines = []
    in_conflict = False
    keep_section = False
    
    for line in lines:
        if line.startswith('<<<<<<< HEAD'):
            in_conflict = True
            keep_section = True
            continue
        elif line.startswith('======='):
            keep_section = False
            continue
        elif line.startswith('>>>>>>> '):
            in_conflict = False
            continue
        
        if not in_conflict or keep_section:
            resolved_lines.append(line)
    
    resolved_content = '\n'.join(resolved_lines)
    
    try:
        with open('workers/manager.ts', 'w') as f:
            f.write(resolved_content)
        print("Successfully resolved workers/manager.ts")
        return True
    except Exception as e:
        print(f"Error writing workers/manager.ts: {e}")
        return False

def main():
    print("Starting automatic conflict resolution...")
    
    # Get list of conflicted files
    conflicted_files = get_conflicted_files()
    print(f"Found {len(conflicted_files)} conflicted files")
    
    resolved_count = 0
    
    for filepath in conflicted_files:
        print(f"\nProcessing: {filepath}")
        
        if filepath == '.cursor/rules/guidelines.md':
            if resolve_guidelines_conflict():
                resolved_count += 1
        elif filepath == 'workers/README.md':
            if resolve_workers_readme_conflict():
                resolved_count += 1
        elif filepath == 'workers/manager.ts':
            if resolve_manager_conflict():
                resolved_count += 1
        elif filepath.endswith('.test.ts'):
            if resolve_test_file_conflict(filepath):
                resolved_count += 1
                # Stage the resolved file
                run_git_command(f"git add {filepath}")
        else:
            print(f"Skipping non-test file: {filepath}")
    
    print(f"\nResolved {resolved_count} out of {len(conflicted_files)} conflicted files")
    
    # Stage all resolved files
    run_git_command("git add .")
    
    print("All conflicts resolved! Ready to commit the merge.")
    return resolved_count == len(conflicted_files)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)