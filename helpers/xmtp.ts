import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { type Persona } from "./personas";

export type { Conversation, DecodedMessage, XmtpEnv };
export { Client };

export async function verifyDM(
  action: () => Promise<any>,
  receivers: Persona[],
) {
  try {
    // Set up message collectors for each receiver
    const messageCollectors = receivers.map(async (r) => {
      const messages: DecodedMessage[] = [];
      const stream = r.worker?.stream("text");

      if (!stream) {
        throw new Error(
          `Failed to create stream for receiver ${r.client?.accountAddress}`,
        );
      }

      // Create an async function to collect messages
      const collectMessages = async () => {
        for (let i = 0; i < 5; i++) {
          // Collect up to 5 messages
          const msg = await stream;
          messages.push(msg.message);
        }
        return messages;
      };

      return collectMessages();
    });

    // Wait a bit before sending messages
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await action();

    const receivedMessages = await Promise.all(messageCollectors);

    // Flatten and filter out any undefined messages
    const parsedMessageContent = receivedMessages
      .flat()
      .filter((msg): msg is DecodedMessage => msg.content !== undefined);

    console.log(`Received ${parsedMessageContent.length} messages:`);
    const messageContent = parsedMessageContent.map(
      (msg) => msg.content as string,
    );
    return messageContent;
  } catch (error) {
    console.error(
      "verifyDM error:",
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

export async function verifyMetadataUpdates(
  action: () => Promise<any>,
  receivers: Persona[],
  { fieldName, newValue }: { fieldName: string; newValue: string },
) {
  try {
    const messagePromises = receivers.map((r) =>
      r.worker?.stream("group_updated"),
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await action();
    const receivedMessages = await Promise.all(messagePromises);

    const metadataContent = receivedMessages.map(
      (r) => r?.message.content as GroupMetadataContent,
    );

    const nameChange = metadataContent.map((c) =>
      c.metadataFieldChanges.find((change) => change.fieldName === fieldName),
    );

    const messageContent = nameChange.map((c) => c?.newValue);
    return messageContent;
  } catch (error) {
    console.error(
      "verifyMetadataUpdates error:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

type GroupMetadataContent = {
  metadataFieldChanges: Array<{
    fieldName: string;
    newValue: string;
    oldValue: string;
  }>;
};
