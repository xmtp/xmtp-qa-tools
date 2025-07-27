#!/bin/bash

# XMTP Workflow Testing Helper Script
# This script helps you test GitHub workflows safely without affecting main

set -e

TESTING_BRANCH="workflow-testing"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  setup              Create and setup the workflow testing branch"
    echo "  test [TYPE]        Run workflow tests (functional, performance, agents, browser, delivery, all)"
    echo "  push               Push current changes to testing branch (triggers workflows)"
    echo "  status             Show status of workflow testing branch"
    echo "  cleanup            Clean up the testing branch"
    echo "  enable-pr-tests    Enable PR testing on specific workflows"
    echo "  disable-pr-tests   Disable PR testing on workflows"
    echo ""
    echo "Examples:"
    echo "  $0 setup                    # Setup testing environment"
    echo "  $0 test functional          # Test functional workflows"
    echo "  $0 push                     # Push changes and trigger tests"
    echo "  $0 enable-pr-tests Performance.yml  # Enable PR testing for Performance workflow"
}

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_git_status() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not in a git repository"
        exit 1
    fi
}

setup_testing_branch() {
    log "Setting up workflow testing branch..."
    
    # Check if testing branch exists
    if git show-ref --verify --quiet refs/heads/$TESTING_BRANCH; then
        warn "Testing branch '$TESTING_BRANCH' already exists"
        git checkout $TESTING_BRANCH
        git pull origin main --no-edit
    else
        # Create testing branch from main
        git checkout main
        git pull origin main
        git checkout -b $TESTING_BRANCH
        git push -u origin $TESTING_BRANCH
    fi
    
    log "Testing branch '$TESTING_BRANCH' is ready"
    log "You can now modify workflows and push to test them safely"
}

run_workflow_test() {
    local test_type=${1:-"functional"}
    
    log "Triggering workflow test: $test_type"
    
    # Use GitHub CLI if available
    if command -v gh &> /dev/null; then
        gh workflow run "Workflow Testing" \
            --field test_type="$test_type" \
            --field environment="dev" \
            --ref $TESTING_BRANCH
        log "Workflow triggered. Check status with: gh run list --workflow='Workflow Testing'"
    else
        warn "GitHub CLI not found. Please install 'gh' or trigger manually:"
        echo "1. Go to: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
        echo "2. Select 'Workflow Testing' workflow"
        echo "3. Click 'Run workflow' and select test type: $test_type"
    fi
}

push_and_test() {
    log "Pushing changes to testing branch..."
    
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "$TESTING_BRANCH" ]; then
        warn "Not on testing branch. Switching to $TESTING_BRANCH"
        git checkout $TESTING_BRANCH
    fi
    
    # Check for changes
    if git diff --quiet && git diff --cached --quiet; then
        warn "No changes to push"
        return
    fi
    
    git add .
    git commit -m "Testing workflow changes - $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin $TESTING_BRANCH
    
    log "Changes pushed. Workflows will be triggered automatically."
    log "Monitor progress at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
}

show_status() {
    log "Workflow Testing Status"
    echo "======================="
    
    current_branch=$(git branch --show-current)
    echo "Current branch: $current_branch"
    
    if git show-ref --verify --quiet refs/heads/$TESTING_BRANCH; then
        echo "Testing branch: ✅ exists"
        
        # Show last commit on testing branch
        last_commit=$(git log $TESTING_BRANCH -1 --oneline 2>/dev/null || echo "No commits")
        echo "Last commit: $last_commit"
        
        # Show if there are differences from main
        if git diff --quiet main..$TESTING_BRANCH; then
            echo "Differences from main: ❌ none"
        else
            echo "Differences from main: ✅ yes"
            git diff --stat main..$TESTING_BRANCH
        fi
    else
        echo "Testing branch: ❌ does not exist (run 'setup' first)"
    fi
    
    # Show GitHub Actions status if gh is available
    if command -v gh &> /dev/null; then
        echo ""
        echo "Recent workflow runs:"
        gh run list --branch=$TESTING_BRANCH --limit=5 --json status,conclusion,workflowName,createdAt --template '{{range .}}{{.workflowName}} | {{.status}} | {{.conclusion}} | {{timeago .createdAt}}{{"\n"}}{{end}}'
    fi
}

cleanup_testing() {
    log "Cleaning up testing branch..."
    
    current_branch=$(git branch --show-current)
    if [ "$current_branch" = "$TESTING_BRANCH" ]; then
        git checkout main
    fi
    
    if git show-ref --verify --quiet refs/heads/$TESTING_BRANCH; then
        git branch -D $TESTING_BRANCH
        git push origin --delete $TESTING_BRANCH
        log "Testing branch cleaned up"
    else
        warn "Testing branch does not exist"
    fi
}

enable_pr_tests() {
    local workflow_file=$1
    if [ -z "$workflow_file" ]; then
        error "Please specify a workflow file (e.g., Performance.yml)"
        exit 1
    fi
    
    local workflow_path=".github/workflows/$workflow_file"
    if [ ! -f "$workflow_path" ]; then
        error "Workflow file not found: $workflow_path"
        exit 1
    fi
    
    log "Enabling PR tests for $workflow_file..."
    
    # Uncomment pull_request trigger if it exists
    sed -i 's/#pull_request:/pull_request:/' "$workflow_path"
    
    log "PR testing enabled for $workflow_file"
    log "Remember to commit and push these changes"
}

disable_pr_tests() {
    local workflow_file=$1
    if [ -z "$workflow_file" ]; then
        # Disable for all workflows
        log "Disabling PR tests for all workflows..."
        find .github/workflows -name "*.yml" -exec sed -i 's/pull_request:/#pull_request:/' {} \;
    else
        local workflow_path=".github/workflows/$workflow_file"
        if [ ! -f "$workflow_path" ]; then
            error "Workflow file not found: $workflow_path"
            exit 1
        fi
        
        log "Disabling PR tests for $workflow_file..."
        sed -i 's/pull_request:/#pull_request:/' "$workflow_path"
    fi
    
    log "PR testing disabled"
    log "Remember to commit and push these changes"
}

# Main script logic
check_git_status

case "${1:-}" in
    "setup")
        setup_testing_branch
        ;;
    "test")
        run_workflow_test "$2"
        ;;
    "push")
        push_and_test
        ;;
    "status")
        show_status
        ;;
    "cleanup")
        cleanup_testing
        ;;
    "enable-pr-tests")
        enable_pr_tests "$2"
        ;;
    "disable-pr-tests")
        disable_pr_tests "$2"
        ;;
    "help"|"-h"|"--help")
        print_usage
        ;;
    "")
        print_usage
        exit 1
        ;;
    *)
        error "Unknown command: $1"
        print_usage
        exit 1
        ;;
esac