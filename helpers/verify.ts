import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { type Persona } from "./workers/creator";

export type { Conversation, DecodedMessage, XmtpEnv };
export { Client };

export async function verifyDM(
  action: () => Promise<any>,
  receivers: Persona[],
  amount: number = 1,
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
        for (let i = 0; i < amount; i++) {
          // Collect up to 5 messages
          console.time(`[${r.client?.accountAddress}] Collect message`);
          const msg = await stream;
          console.timeEnd(`[${r.client?.accountAddress}] Collect message`);
          messages.push(msg.message);
        }
        return messages;
      };

      return collectMessages();
    });

    // Wait a bit before sending messages
    console.time("helpers/verify.ts: Waited 1 second");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.timeEnd("helpers/verify.ts: Waited 1 second");

    console.time("helpers/verify.ts: Send the dms");
    await action();
    console.timeEnd("helpers/verify.ts: Send the dms");

    console.time("helpers/verify.ts: Collect all messages");
    const receivedMessages = await Promise.all(messageCollectors);
    console.timeEnd("helpers/verify.ts: Collect all messages");

    // Flatten and filter out any undefined messages
    const parsedMessageContent = receivedMessages
      .flat()
      .filter((msg): msg is DecodedMessage => msg.content !== undefined);

    const messageContent = parsedMessageContent.map(
      (msg) => msg.content as string,
    );
    console.log(`Received ${messageContent.join(", ")}`);
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
    console.time("helpers/verify.ts: Setup message promises");
    const messagePromises = receivers.map((r) =>
      r.worker?.stream("group_updated"),
    );
    console.timeEnd("helpers/verify.ts: Setup message promises");

    console.time("helpers/verify.ts: Waited 2 seconds");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.timeEnd("helpers/verify.ts: Waited 2 seconds");

    console.time("helpers/verify.ts: Sent the group update");
    await action();
    console.timeEnd("helpers/verify.ts: Sent the group update");

    console.time("helpers/verify.ts: Collect metadata messages");
    const receivedMessages = await Promise.all(messagePromises);
    console.timeEnd("helpers/verify.ts: Collect metadata messages");

    const metadataContent = receivedMessages.map(
      (r) => r?.message.content as GroupMetadataContent,
    );

    const nameChange = metadataContent.map((c) =>
      c.metadataFieldChanges.find(
        (change) =>
          change.fieldName === fieldName && change.newValue === newValue,
      ),
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
