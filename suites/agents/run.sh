#!/bin/bash

# Script to test local agent against dev, local, and prod environments
# Tests with 5 users per environment

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

# Configuration
AGENT="bankr"
USERS=300
ENVIRONMENTS=("production")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting local agent stress testing across environments${NC}"
echo -e "${BLUE}Agent: ${AGENT}${NC}"
echo -e "${BLUE}Users per environment: ${USERS}${NC}"
echo -e "${BLUE}Environments: ${ENVIRONMENTS[*]}${NC}"
echo ""

# Remove old logs
rm -rf logs

echo -e "${YELLOW}📅 Starting test cycle at $(date)${NC}"
echo ""

# Test results tracking
declare -A results
overall_success=true

# Test each environment
for env in "${ENVIRONMENTS[@]}"; do
    echo -e "${BLUE}🔬 Testing environment: ${env}${NC}"
    echo "----------------------------------------"
    
    # Run the stress test
    if yarn stress --env "${env}" --agent "${AGENT}" --users "${USERS}"; then
        echo -e "${GREEN}✅ ${env} environment: SUCCESS${NC}"
        results[$env]="SUCCESS"
    else
        echo -e "${RED}❌ ${env} environment: FAILED${NC}"
        results[$env]="FAILED"
        overall_success=false
    fi
    
    echo ""
done

# Summary report
echo -e "${YELLOW}📊 CYCLE SUMMARY${NC}"
echo "========================================"
for env in "${ENVIRONMENTS[@]}"; do
    if [[ "${results[$env]}" == "SUCCESS" ]]; then
        echo -e "${env}: ${GREEN}${results[$env]}${NC}"
    else
        echo -e "${env}: ${RED}${results[$env]}${NC}"
    fi
done

if $overall_success; then
    echo -e "${GREEN}🎉 All environments passed!${NC}"
else
    echo -e "${RED}⚠️  Some environments failed${NC}"
fi

# Clear results for next cycle
unset results
