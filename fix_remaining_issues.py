#!/usr/bin/env python3

import os
import re
import glob

def fix_file(filepath, fixes):
    """Apply fixes to a file"""
    print(f"Fixing: {filepath}")
    
    try:
        with open(filepath, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return False
    
    original_content = content
    
    for fix_type, pattern, replacement in fixes:
        if fix_type == "regex":
            content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
        elif fix_type == "string":
            content = content.replace(pattern, replacement)
    
    if content != original_content:
        try:
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"Successfully fixed: {filepath}")
            return True
        except Exception as e:
            print(f"Error writing {filepath}: {e}")
            return False
    else:
        print(f"No changes needed: {filepath}")
        return True

def main():
    fixes = [
        # Fix agents.test.ts - remove duplicate import and fix path
        ("suites/agents/agents.test.ts", [
            ("string", 'import productionAgents from "@inboxes/agents.json";', ''),
            ("string", 'import productionAgents from "./agents.json";', 'import productionAgents from "./agents.json";'),
        ]),
        
        # Fix bench.test.ts - add testName parameter
        ("suites/bench/bench.test.ts", [
            ("regex", r'const zWorker = await getWorkers\(\[zWorkerName\]\);', 'const zWorker = await getWorkers([zWorkerName], testName);'),
        ]),
        
        # Fix bug_panic/test.test.ts - add testName parameter  
        ("suites/bugs/bug_panic/test.test.ts", [
            ("regex", r'const workers = await getWorkers\(getFixedNames\(50\)\);', 'const workers = await getWorkers(getFixedNames(50), testName);'),
        ]),
        
        # Fix bug_stitch/stitch.test.ts - add testName parameters
        ("suites/bugs/bug_stitch/stitch.test.ts", [
            ("regex", r'const workers = await getWorkers\(\[randomName\]\);', 'const workers = await getWorkers([randomName], testName);'),
            ("regex", r'const workers = await getWorkers\(\[randomName \+ "-b"\]\);', 'const workers = await getWorkers([randomName + "-b"], testName);'),
            ("regex", r'const workers = await getWorkers\(\[randomName \+ "-c"\]\);', 'const workers = await getWorkers([randomName + "-c"], testName);'),
        ]),
        
        # Fix commits.test.ts - import typeOfSync
        ("suites/commits/commits.test.ts", [
            ("string", 'import { typeofStream } from "@workers/main";', 'import { typeofStream, typeOfSync } from "@workers/main";'),
        ]),
        
        # Fix clients.test.ts - add testName parameter
        ("suites/functional/clients.test.ts", [
            ("regex", r'const client = await getWorkers\(\["randomclient"\]\);', 'const client = await getWorkers(["randomclient"], testName);'),
        ]),
        
        # Fix installations.test.ts - add testName parameters
        ("suites/functional/installations.test.ts", [
            ("regex", r'const secondaryWorkers = await getWorkers\(\[', 'const secondaryWorkers = await getWorkers(['),
            ("regex", r'const fourthWorkers = await getWorkers\(\[names\[2\] \+ "-c"\]\);', 'const fourthWorkers = await getWorkers([names[2] + "-c"], testName);'),
            ("regex", r'(\s+)const workers = await getWorkers\(\[\s*', r'\1const workers = await getWorkers(['),
        ]),
        
        # Fix regression.test.ts - add testName parameters
        ("suites/functional/regression.test.ts", [
            ("regex", r'workers = await getWorkers\(\["bob-" \+ "a" \+ "-" \+ version\]\);', 'workers = await getWorkers(["bob-" + "a" + "-" + version], testName);'),
            ("regex", r'workers = await getWorkers\(\["alice-" \+ "a" \+ "-" \+ version\]\);', 'workers = await getWorkers(["alice-" + "a" + "-" + version], testName);'),
        ]),
        
        # Fix streams.test.ts - add testName parameter
        ("suites/functional/streams.test.ts", [
            ("regex", r'let workers = await getWorkers\(names\);', 'let workers = await getWorkers(names, testName);'),
        ]),
        
        # Fix performance.test.ts - add testName parameters
        ("suites/metrics/performance.test.ts", [
            ("regex", r'const client = await getWorkers\(\["randomclient"\]\);', 'const client = await getWorkers(["randomclient"], testName);'),
        ]),
        
        # Fix rate-limited.test.ts - import typeOfSync
        ("suites/other/rate-limited.test.ts", [
            ("string", 'import { typeofStream } from "@workers/main";', 'import { typeofStream, typeOfSync } from "@workers/main";'),
        ]),
    ]
    
    fixed_count = 0
    
    for filepath, file_fixes in fixes:
        if os.path.exists(filepath):
            if fix_file(filepath, file_fixes):
                fixed_count += 1
        else:
            print(f"File not found: {filepath}")
    
    # Fix installations.test.ts manually since it needs special handling
    installations_path = "suites/functional/installations.test.ts"
    if os.path.exists(installations_path):
        with open(installations_path, 'r') as f:
            content = f.read()
        
        # Add testName to all getWorkers calls that are missing it
        content = re.sub(
            r'const secondaryWorkers = await getWorkers\(\[\s*names\[0\] \+ "-b",\s*\]\);',
            'const secondaryWorkers = await getWorkers([names[0] + "-b"], testName);',
            content
        )
        content = re.sub(
            r'const workers = await getWorkers\(\[\s*names\[0\] \+ "-d",\s*names\[1\] \+ "-d",\s*names\[2\] \+ "-d",\s*\]\);',
            'const workers = await getWorkers([names[0] + "-d", names[1] + "-d", names[2] + "-d"], testName);',
            content
        )
        
        with open(installations_path, 'w') as f:
            f.write(content)
        print(f"Manually fixed: {installations_path}")
        fixed_count += 1
    
    # Fix workers/manager.ts - remove testName property assignment
    manager_path = "workers/manager.ts"
    if os.path.exists(manager_path):
        with open(manager_path, 'r') as f:
            content = f.read()
        
        # Remove the line that assigns testName property
        content = re.sub(r'\s*this\.testName = testName;\s*\n', '', content)
        
        with open(manager_path, 'w') as f:
            f.write(content)
        print(f"Fixed manager.ts testName property issue")
        fixed_count += 1
    
    print(f"\nFixed {fixed_count} files")
    return True

if __name__ == "__main__":
    main()