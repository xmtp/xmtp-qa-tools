# Key Check Agent

This agent helps you check the status of XMTP key packages for yourself or other addresses.

Once the agent is running, you can interact with it using the following commands:

- `/kc` - Check key package status for the sender
- `/kc inboxid <INBOX_ID>` - Check key package status for a specific inbox ID
- `/kc address <ADDRESS>` - Check key package status for a specific address
- `/kc groupid` - Show the current conversation ID
- `/kc members` - List all members' inbox IDs in the current conversation
- `/kc version` - Show XMTP SDK version information
- `/kc help` - Show the help message with available commands

The agent will respond with information about the key packages, including:

- Total number of installations
- Number of valid and invalid installations
- Creation and expiry dates for valid installations
- Error messages for invalid installations
