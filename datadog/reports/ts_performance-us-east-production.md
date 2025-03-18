METRICS SUMMARY
===============

Operation | Members | Samples | Avg (ms) | Min/Max (ms) | Threshold (ms) | Pass Rate | Status
----------|---------|---------|----------|--------------|----------------|-----------|-------
clientCreate:operation | - | 1 | 4188 | 4188/4188 | 4500 | 100.0% | PASS ✅
inboxState:operation | - | 1 | 196 | 196/196 | 200 | 100.0% | PASS ✅
inboxState:network | - | 5 | 332 | 3/826 | 200 | 60.0% | FAIL ❌
clientCreate:network | - | 5 | 439 | 53/1044 | 200 | 40.0% | FAIL ❌
createDM:operation | - | 1 | 2066 | 2066/2066 | 1800 | 0.0% | FAIL ❌
createDM:network | - | 5 | 319 | 7/791 | 200 | 60.0% | FAIL ❌
sendGM:operation | - | 1 | 1024 | 1024/1024 | 1200 | 100.0% | PASS ✅
sendGM:network | - | 5 | 321 | 2/799 | 200 | 60.0% | FAIL ❌
receiveGM:operation | - | 1 | 835 | 835/835 | 1000 | 100.0% | PASS ✅
receiveGM:network | - | 5 | 324 | 2/809 | 200 | 60.0% | FAIL ❌
createGroup:operation | - | 1 | 1878 | 1878/1878 | 2000 | 100.0% | PASS ✅
createGroup:network | - | 5 | 318 | 3/792 | 200 | 60.0% | FAIL ❌
createGroupByIdentifiers:operation | - | 1 | 2060 | 2060/2060 | 2000 | 0.0% | FAIL ❌
syncGroup:operation | - | 1 | 765 | 765/765 | 2000 | 100.0% | PASS ✅
createGroupByIdentifiers:network | - | 5 | 333 | 7/826 | 200 | 60.0% | FAIL ❌
syncGroup:network | - | 5 | 320 | 5/795 | 200 | 60.0% | FAIL ❌
updateGroupName:operation | - | 1 | 1055 | 1055/1055 | 2000 | 100.0% | PASS ✅
updateGroupName:network | - | 5 | 332 | 2/828 | 200 | 40.0% | FAIL ❌
removeMembers:operation | - | 1 | 1033 | 1033/1033 | 1000 | 0.0% | FAIL ❌
sendGroupMessage:operation | - | 1 | 600 | 600/600 | 2000 | 100.0% | PASS ✅
removeMembers:network | - | 5 | 335 | 3/835 | 200 | 40.0% | FAIL ❌
sendGroupMessage:network | - | 5 | 336 | 3/837 | 200 | 60.0% | FAIL ❌
receiveGroupMessage:operation | - | 1 | 978 | 978/978 | 2000 | 100.0% | PASS ✅
receiveGroupMessage:network | - | 5 | 398 | 6/989 | 200 | 40.0% | FAIL ❌
createGroup:operation:4 | 4 | 1 | 1539 | 1539/1539 | 2000 | 100.0% | PASS ✅
createGroup:network:4 | 4 | 5 | 318 | 2/792 | 200 | 60.0% | FAIL ❌
createGroupByIdentifiers:operation:4 | 4 | 1 | 1809 | 1809/1809 | 2000 | 100.0% | PASS ✅
syncGroup:operation:4 | 4 | 1 | 718 | 718/718 | 2000 | 100.0% | PASS ✅
createGroupByIdentifiers:network:4 | 4 | 5 | 328 | 3/816 | 200 | 60.0% | FAIL ❌
updateGroupName:operation:4 | 4 | 1 | 757 | 757/757 | 2000 | 100.0% | PASS ✅
syncGroup:network:4 | 4 | 5 | 404 | 5/1005 | 200 | 40.0% | FAIL ❌
updateGroupName:network:4 | 4 | 5 | 321 | 4/797 | 200 | 60.0% | FAIL ❌
removeMembers:operation:4 | 4 | 1 | 987 | 987/987 | 1000 | 100.0% | PASS ✅
sendGroupMessage:operation:4 | 4 | 1 | 610 | 610/610 | 2000 | 100.0% | PASS ✅
removeMembers:network:4 | 4 | 5 | 333 | 3/829 | 200 | 60.0% | FAIL ❌
receiveGroupMessage:operation:4 | 4 | 1 | 988 | 988/988 | 2000 | 100.0% | PASS ✅
sendGroupMessage:network:4 | 4 | 5 | 392 | 5/974 | 200 | 40.0% | FAIL ❌
receiveGroupMessage:network:4 | 4 | 5 | 324 | 2/807 | 200 | 60.0% | FAIL ❌
createGroup:operation:8 | 8 | 1 | 1604 | 1604/1604 | 2000 | 100.0% | PASS ✅
createGroup:network:8 | 8 | 5 | 404 | 5/1006 | 200 | 40.0% | FAIL ❌
createGroupByIdentifiers:operation:8 | 8 | 1 | 2040 | 2040/2040 | 2000 | 0.0% | FAIL ❌
syncGroup:operation:8 | 8 | 1 | 552 | 552/552 | 2000 | 100.0% | PASS ✅
createGroupByIdentifiers:network:8 | 8 | 5 | 314 | 2/782 | 200 | 60.0% | FAIL ❌
syncGroup:network:8 | 8 | 5 | 323 | 2/805 | 200 | 60.0% | FAIL ❌
updateGroupName:operation:8 | 8 | 1 | 1040 | 1040/1040 | 2000 | 100.0% | PASS ✅
updateGroupName:network:8 | 8 | 5 | 319 | 6/791 | 200 | 60.0% | FAIL ❌
removeMembers:operation:8 | 8 | 1 | 1040 | 1040/1040 | 1000 | 0.0% | FAIL ❌
sendGroupMessage:operation:8 | 8 | 1 | 554 | 554/554 | 2000 | 100.0% | PASS ✅
removeMembers:network:8 | 8 | 5 | 315 | 2/785 | 200 | 60.0% | FAIL ❌
receiveGroupMessage:operation:8 | 8 | 1 | 969 | 969/969 | 2000 | 100.0% | PASS ✅
