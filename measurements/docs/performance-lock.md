# Performance report

- Testing in `local`
- Columns correspond to conversations per member
- 0⚠️ indicates timeout
- Streams are all `streamAllMessages`

## Bindings 1.4.0dev-2

| Operation-Members   | Base | 500 | 1000     | 2000     | 5000      | 10000     |
| ------------------- | ---- | --- | -------- | -------- | --------- | --------- |
| create              | 212  | 286 | 287      | 261      | 233       | 265       |
| sync                | 12   | 3   | 3        | 2        | 2         | 3         |
| syncAll             | 94   | 430 | 1348     | 60238 ⚠️ | 121849 ⚠️ | 300889 ⚠️ |
| storage             | 106  | 190 | 181      | 159      | 159       | 342       |
| inboxState          | 0    | 0   | 0        | 0        | 1         | 0         |
| setConsentStates    | 1    | -   | -        | -        | -         | -         |
| canMessage          | 6    | 5   | 5        | 8        | 5         | 3         |
| newDm               | 19   | 4   | 1        | 1        | 2         | 9         |
| streamMessage       | 51   | 45  | 36       | 120      | 130       | 44        |
| getConversationById | 1    | 2   | 2        | 2        | 4         | 12        |
| send                | 18   | 19  | 22       | 23       | 22        | 15        |
| newGroup-10         | 63   | 59  | 62       | 60       | 51        | 79        |
| groupsync-10        | 6    | 6   | 7        | 9        | 5         | 7         |
| updateName-10       | 18   | 19  | 13       | 18       | 9         | 26        |
| send-10             | 8    | 8   | 7        | 12       | 7         | 15        |
| addAdmin-10         | 13   | 8   | 12       | 12       | 11        | 11        |
| streamMembership-10 | 108  | 70  | 0 ⚠️     | 0 ⚠️     | 0 ⚠️      | 0 ⚠️      |
| removeMembers-10    | 26   | 23  | 48609 ⚠️ | 49179 ⚠️ | 45891 ⚠️  | 43474 ⚠️  |
| addMember-10        | 39   | 26  | 4        | 4        | 3         | 5         |
| streamMessage-10    | 50   | 42  | 47       | 0 ⚠️     | 0 ⚠️      | 0 ⚠️      |
| streamMetadata-10   | 118  | 90  | 58       | 61       | 0 ⚠️      | 0 ⚠️      |

## Bindings 1.4.0dev-1

| Operation-Members   | No conversations | 500 | 1000 | 2000    | 5000     | 10000    |
| ------------------- | ---------------- | --- | ---- | ------- | -------- | -------- |
| create              | 113              | 294 | 289  | 268     | 234      | 245      |
| sync                | 48               | 3   | 3    | 3       | 96       | 34       |
| syncAll             | 69               | 433 | 808  | 60155⚠️ | 122604⚠️ | 300978⚠️ |
| storage             | 2                | 181 | 176  | 155     | 155      | 339      |
| inboxState          | 1                | 0   | 0    | 0       | 0        | 0        |
| canMessage          | 7                | 5   | 5    | 5       | 5        | 5        |
| newDm               | 30               | 28  | 28   | 27      | 31       | 41       |
| streamMessage       | 45               | 54  | 117  | 35      | 110      | 102      |
| getConversationById | 1                | 3   | 2    | 2       | 5        | 11       |
| send                | 19               | 19  | 23   | 14      | 28       | 17       |
| newGroup-10         | 82               | 66  | 54   | 61      | 74       | 54       |
| groupsync-10        | 11               | 8   | 5    | 7       | 10       | 14       |
| updateName-10       | 15               | 13  | 10   | 14      | 14       | 15       |
| send-10             | 12               | 11  | 9    | 16      | 15       | 18       |
| addAdmin-10         | 11               | 13  | 9    | 11      | 24       | 10       |
| streamMembership-10 | 84               | 89  | 77   | 0⚠️     | 0⚠️      | 0⚠️      |
| removeMembers-10    | 31               | 17  | 25   | 50802⚠️ | 48481⚠️  | 43058⚠️  |
| addMember-10        | 36               | 26  | 35   | 4       | 5        | 4        |
| streamMessage-10    | 51               | 43  | 0⚠️  | 0⚠️     | 0⚠️      | 0⚠️      |
| streamMetadata-10   | 44               | 53  | 56   | 77      | 0⚠️      | 0⚠️      |

## Bindings 1.3.4

| Operation-Members    | Base | 500     | 1000    | 2000    | 5000     | 10000    |
| -------------------- | ---- | ------- | ------- | ------- | -------- | -------- |
| create               | 93   | 253     | 253     | 252     | 207      | 222      |
| sync                 | 31   | 3       | 3       | 3       | 85       | 26       |
| syncAll              | 167  | 465     | 1486    | 60212⚠️ | 122666⚠️ | 300928⚠️ |
| storage              | 2    | 181     | 176     | 155     | 155      | 339      |
| inboxState           | 0⚠️  | 0⚠️     | 0⚠️     | 0⚠️     | 1        | 0⚠️      |
| canMessage           | 7    | 5       | 5       | 5       | 9        | 7        |
| newDm                | 31   | 24      | 1       | 28      | 41       | 47       |
| streamMessage        | 63   | 64      | 113     | 125     | 94       | 43       |
| getConversationById  | 1    | 2       | 2       | 5       | 5        | 10       |
| send                 | 19   | 18      | 16      | 22      | 21       | 21       |
| newGroup-10          | 63   | 46      | 69      | 69      | 67       | 65       |
| groupsync-10         | 6    | 5       | 7       | 9       | 8        | 11       |
| updateName-10        | 15   | 9       | 13      | 12      | 29       | 15       |
| send-10              | 7    | 6       | 9       | 14      | 21       | 21       |
| addAdmin-10          | 9    | 8       | 15      | 12      | 10       | 15       |
| streamMembership-10  | 49   | 84      | 0⚠️     | 0⚠️     | 0⚠️      | 0⚠️      |
| removeMembers-10     | 15   | 19      | 48452⚠️ | 49113⚠️ | 44861⚠️  | 43424⚠️  |
| addMember-10         | 31   | 41      | 3       | 6       | 4        | 3        |
| streamMessage-10     | 64   | 47      | 41      | 0⚠️     | 0⚠️      | 0⚠️      |
| streamMetadata-10    | 58   | 51      | 45      | 50      | 0⚠️      | 0⚠️      |
| newGroup-50          | 222  | 54721⚠️ | 58019⚠️ | 51004⚠️ | 43968⚠️  | 43965⚠️  |
| groupsync-50         | 6    | 7       | 13      | 16      | 18       | 59746⚠️  |
| updateName-50        | 17   | 18      | 14      | 47      | 20       | 24       |
| send-50              | 6    | 34      | 21      | 21      | 14       | 25       |
| addAdmin-50          | 11   | 15      | 15      | 28      | 59753⚠️  | 21       |
| streamMembership-50  | 101  | 107     | 102     | 71      | 0⚠️      | 0⚠️      |
| removeMembers-50     | 29   | 28      | 58608⚠️ | 58544⚠️ | 51876⚠️  | 51813⚠️  |
| addMember-50         | 37   | 38      | 36      | 50      | 6        | 12       |
| streamMessage-50     | 45   | 39      | 53      | 37      | 0⚠️      | 0⚠️      |
| streamMetadata-50    | 80   | 97      | 85      | 87      | 0⚠️      | 0⚠️      |
| newGroup-100         | 586  | 56872⚠️ | 58212⚠️ | 58157⚠️ | 104168⚠️ | 104029⚠️ |
| groupsync-100        | 10   | 16      | 16      | 23      | 59632⚠️  | 59646⚠️  |
| updateName-100       | 22   | 20      | 27      | 49      | 40       | 39       |
| send-100             | 9    | 8       | 10      | 59438⚠️ | 24       | 19       |
| addAdmin-100         | 21   | 25      | 24      | 27      | 29       | 36       |
| streamMembership-100 | 125  | 147     | 162     | 142     | 0⚠️      | 0⚠️      |
| removeMembers-100    | 40   | 35      | 38      | 58766⚠️ | 51758⚠️  | 51746⚠️  |
| addMember-100        | 67   | 42      | 60      | 51      | 13       | 9        |
| streamMessage-100    | 61   | 72      | 72      | 80      | 0⚠️      | 0⚠️      |
| streamMetadata-100   | 120  | 136     | 125     | 103     | 0⚠️      | 0⚠️      |

# Bindings 1.4.0dev
