import * as fs from "fs";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

async function main() {
  const numInstallations = 100; // Default to 10 if no argument provided

  // Get network from command line arguments or default to "dev"
  const network = process.env.XMTP_ENV as XmtpEnv;
  const signer = createSigner(
    "0x0bc27c7141c683e9686cea18efdf3a3085cf6cc82725cf68328634a4acf7d207" as `0x${string}`,
  );
  const encryptionKey = getEncryptionKeyFromHex(
    "6495b06b6deaa17796dad65834058ab61f8c391588196273f8e46f44f69fc8f7",
  );

  // Array to store installation data
  const installationData = [];

  console.log(
    `Generating ${numInstallations} XMTP clients for the same account on ${network} network...`,
  );

  let accountAddress = "";

  try {
    const identifier = await signer.getIdentifier();
    accountAddress = identifier.identifier;

    console.log(`Using account address: ${accountAddress}`);

    for (let i = 0; i < numInstallations; i++) {
      // Create an XMTP client using the signer
      const client = await Client.create(signer, {
        dbEncryptionKey: encryptionKey,
        env: network,
      });

      // Get the inbox ID and installation ID for this client
      const inboxId = client.inboxId;
      const installationId = client.installationId;

      // Store the installation data
      installationData.push({
        accountAddress,
        inboxId,
        installationId,
        network,
        installationIndex: i,
      });

      // Write the data to a JSON file
      fs.writeFileSync(
        `./logs/generated-installations.json`,
        JSON.stringify(installationData, null, 2),
      );
      console.log(
        `Created installation ${i + 1}/${numInstallations}: ${installationId}`,
      );
    }
  } catch (error: unknown) {
    console.error(`Error creating XMTP clients:`, error);
  }

  console.log(
    `Successfully generated ${installationData.length} XMTP clients for account ${accountAddress}`,
  );
  console.log(`Data saved to generated-installations.json`);
}

main().catch(console.error);
