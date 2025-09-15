import fs from "fs";
import { IdentifierKind } from "version-management/client-versions";

export function getDbPath(description: string = "xmtp"): string {
  // Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
}

export async function getSenderAddress(
  client: any,
  inboxId: string,
): Promise<string> {
  try {
    const inboxState = await client.preferences.inboxStateFromInboxIds(
      [inboxId],
      true,
    );

    if (!inboxState || inboxState.length === 0) {
      return "Unknown";
    }

    const ethIdentifier = inboxState[0].identifiers.find(
      (id: any) => id.identifierKind === IdentifierKind.Ethereum,
    );

    return ethIdentifier ? ethIdentifier.identifier : "Unknown";
  } catch (error) {
    console.error(`Error resolving address for inbox ${inboxId}:`, error);
    return "Failed to resolve";
  }
}
