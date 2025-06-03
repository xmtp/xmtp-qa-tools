import {
  getExistingGroupIds,
  saveGroupToEnv,
} from "./suites/automated/group/helper";

console.log("Testing saveGroupToEnv function...");

// Test 1: Check existing groups
console.log("\n1. Checking existing groups:");
const existingGroups = getExistingGroupIds();
console.log("Existing groups:", existingGroups);

// Test 2: Save a test group ID
console.log("\n2. Saving test group ID:");
const testGroupId = "test-group-id-12345";
saveGroupToEnv(testGroupId);

// Test 3: Check if it was saved
console.log("\n3. Checking if group was saved:");
const updatedGroups = getExistingGroupIds();
console.log("Updated groups:", updatedGroups);
console.log("Group saved successfully:", updatedGroups.includes(testGroupId));

// Test 4: Save another group ID
console.log("\n4. Saving another test group ID:");
const testGroupId2 = "test-group-id-67890";
saveGroupToEnv(testGroupId2);

// Test 5: Final check
console.log("\n5. Final check:");
const finalGroups = getExistingGroupIds();
console.log("Final groups:", finalGroups);
console.log(
  "Both groups saved:",
  finalGroups.includes(testGroupId) && finalGroups.includes(testGroupId2),
);
