import { createSigner, createSigner47 } from "@helpers/client";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
import {
  Client as Client13,
  Conversation as Conversation13,
} from "@xmtp/node-sdk-0.0.13";
import {
  Client as Client47,
  Conversation as Conversation47,
  Dm as Dm47,
  Group as Group47,
} from "@xmtp/node-sdk-0.0.47";
import {
  Client as Client105,
  Conversation as Conversation105,
  Dm as Dm105,
  Group as Group105,
} from "@xmtp/node-sdk-1.0.5";
import {
  Client as Client209,
  Conversation as Conversation209,
  Dm as Dm209,
  Group as Group209,
} from "@xmtp/node-sdk-2.0.9";
import {
  Client as Client210,
  Conversation as Conversation210,
  Dm as Dm210,
  Group as Group210,
} from "@xmtp/node-sdk-2.1.0";
import {
  Client as Client220,
  Conversation as Conversation220,
  Dm as Dm220,
  Group as Group220,
} from "@xmtp/node-sdk-2.2.1";
import {
  Client as Client300,
  Conversation as Conversation300,
  Dm as Dm300,
  Group as Group300,
} from "@xmtp/node-sdk-3.0.1";
import {
  Client as Client310,
  Conversation as Conversation310,
  Dm as Dm310,
  Group as Group310,
} from "@xmtp/node-sdk-3.1.0";
import {
  Client as Client310dev,
  Conversation as Conversation310dev,
  Dm as Dm310dev,
  Group as Group310dev,
} from "@xmtp/node-sdk-3.1.0dev";

export const getAutoVersions = () => {
  return VersionList.filter((v) => v.auto);
};

// SDK version mappings
export const VersionList = [
  {
    Client: Client310dev,
    Conversation: Conversation310dev,
    Dm: Dm310dev,
    Group: Group310dev,
    nodeVersion: "3.1.0dev",
    bindingsPackage: "1.2.6dev",
    auto: false,
  },
  {
    Client: Client310,
    Conversation: Conversation310,
    Dm: Dm310,
    Group: Group310,
    nodeVersion: "3.1.0",
    bindingsPackage: "1.2.6",
    auto: false,
  },
  {
    Client: Client300,
    Conversation: Conversation300,
    Dm: Dm300,
    Group: Group300,
    nodeVersion: "3.0.1",
    bindingsPackage: "1.2.5",
    auto: true,
  },
  {
    Client: Client220,
    Conversation: Conversation220,
    Dm: Dm220,
    Group: Group220,
    nodeVersion: "2.2.1",
    bindingsPackage: "1.2.2",
    auto: true,
  },
  {
    Client: Client210,
    Conversation: Conversation210,
    Dm: Dm210,
    Group: Group210,
    nodeVersion: "2.1.0",
    bindingsPackage: "1.2.0",
    auto: true,
  },
  {
    Client: Client209,
    Conversation: Conversation209,
    Dm: Dm209,
    Group: Group209,
    nodeVersion: "2.0.9",
    bindingsPackage: "1.1.8",
    auto: true,
  },
  {
    Client: Client105,
    Conversation: Conversation105,
    Dm: Dm105,
    Group: Group105,
    nodeVersion: "1.0.5",
    bindingsPackage: "1.1.3",
    auto: true,
  },
  {
    Client: Client47,
    Conversation: Conversation47,
    Dm: Dm47,
    Group: Group47,
    nodeVersion: "0.0.47",
    bindingsPackage: "0.4.1",
    auto: true,
  },
  {
    Client: Client13,
    Conversation: Conversation13,
    Dm: Conversation13,
    Group: Conversation13,
    nodeVersion: "0.0.13",
    bindingsPackage: "0.0.9",
    auto: true,
  },
];

export const regressionClient = async (
  nodeVersion: string,
  walletKey: `0x${string}`,
  dbEncryptionKey: Uint8Array,
  dbPath: string,
  env: XmtpEnv,
  apiURL?: string,
): Promise<unknown> => {
  const loggingLevel = (process.env.LOGGING_LEVEL || "error") as LogLevel;
  const apiUrl = apiURL;
  if (apiUrl) {
    console.log(
      `Creating API client with: SDK version: ${nodeVersion} walletKey: ${String(walletKey)} API URL: ${String(apiUrl)}`,
    );
  }

  const versionConfig = VersionList.find((v) => v.nodeVersion === nodeVersion);
  if (!versionConfig) {
    throw new Error(`SDK version ${nodeVersion} not found in VersionList`);
  }
  const ClientClass = versionConfig.Client;
  let client = null;

  if (versionConfig.nodeVersion === "0.0.13") {
    throw new Error("Invalid version");
  } else if (versionConfig.nodeVersion === "0.0.47") {
    const signer = createSigner47(walletKey);

    // @ts-expect-error: SDK version compatibility - signer interface differs across versions
    client = await ClientClass.create(signer, dbEncryptionKey, {
      dbPath,
      env,
      loggingLevel,
      apiUrl,
    });
  } else if (versionConfig.nodeVersion === "1.0.5") {
    const signer = createSigner(walletKey);
    // @ts-expect-error: SDK version compatibility - signer interface differs across versions
    client = await ClientClass.create(signer, dbEncryptionKey, {
      dbPath,
      env,
      loggingLevel,
      apiUrl,
    });
  } else {
    const signer = createSigner(walletKey);
    // @ts-expect-error: SDK version compatibility - signer interface differs across versions
    client = await ClientClass.create(signer, {
      dbEncryptionKey,
      dbPath,
      env,
      loggingLevel,
      apiUrl,
      codecs: [new ReactionCodec(), new ReplyCodec()],
    });
  }

  if (!client) {
    throw new Error(`Failed to create client for SDK version ${nodeVersion}`);
  }

  return client;
};
