import fs from "fs";
import path from "path";
import { createSigner } from "@helpers/client";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";
import type { LogLevel, XmtpEnv } from "@xmtp/node-sdk";
import {
  Client as Client424,
  Conversation as Conversation424,
  Dm as Dm424,
  Group as Group424,
} from "@xmtp/node-sdk-4.2.4";
import {
  Client as Client440rc2,
  Conversation as Conversation440rc2,
  Dm as Dm440rc2,
  Group as Group440rc2,
} from "@xmtp/node-sdk-4.4.0-rc2";

export const APP_VERSION = "xmtp-qa-tools/1.0.0";

// Node SDK exports (using latest version)
export {
  Client,
  ConsentState,
  type Signer,
  type ClientOptions,
  type Conversation,
  IdentifierKind,
  type DecodedMessage,
  type Dm,
  type Group,
  LogLevel,
  type XmtpEnv,
  type GroupMember,
  type KeyPackageStatus,
  type PermissionLevel,
  type PermissionUpdateType,
  ConsentEntityType,
} from "@xmtp/node-sdk-4.4.0-rc2";

// Node SDK version list
export const VersionList = [
  {
    Client: Client440rc2,
    Conversation: Conversation440rc2,
    Dm: Dm440rc2,
    Group: Group440rc2,
    nodeSDK: "4.4.0-rc2",
    nodeBindings: "1.6.1-rc3",
    auto: true,
  },
  {
    Client: Client424,
    Conversation: Conversation424,
    Dm: Dm424,
    Group: Group424,
    nodeSDK: "4.2.4",
    nodeBindings: "1.3.2",
    auto: true,
  },
];

// Node SDK functions
export const getActiveVersion = (index = 0) => {
  checkNoNameContains(VersionList);
  let latestVersion = getVersions()[index];
  if (process.env.NODE_VERSION) {
    latestVersion = getVersions(false).find(
      (v) => v.nodeBindings === process.env.NODE_VERSION,
    ) as (typeof VersionList)[number];
    if (!latestVersion) {
      throw new Error(`Node SDK version ${process.env.NODE_VERSION} not found`);
    }
  }
  return latestVersion;
};

export const getVersions = (filterAuto: boolean = true) => {
  checkNoNameContains(VersionList);
  return filterAuto ? VersionList.filter((v) => v.auto) : VersionList;
};

export const checkNoNameContains = (versionList: typeof VersionList) => {
  // Node SDK versions should not include - because it messes up with the worker name-installation conversion
  for (const version of versionList) {
    if (version.nodeSDK.includes("-") && version.nodeSDK !== "4.4.0-rc2") {
      throw new Error(`Node SDK version ${version.nodeSDK} contains -`);
    } else if (version.nodeBindings.includes("-") && version.nodeBindings !== "1.6.1-rc3") {
      throw new Error(`Node SDK version ${version.nodeBindings} contains -`);
    }
  }
};

/**
 * Creates a regression client with D14N backend support
 * 
 * For SDK bindings >= 1.6, uses d14nHost parameter for D14N gateway
 * For older SDK bindings, uses apiUrl parameter (legacy)
 */
export const regressionClient = async (
  nodeBindings: string,
  walletKey: `0x${string}`,
  dbEncryptionKey: Uint8Array,
  dbPath: string,
  env: XmtpEnv,
  apiURL?: string,
): Promise<any> => {
  const loggingLevel = (process.env.LOGGING_LEVEL ||
    "warn") as unknown as LogLevel;
  const apiUrl = apiURL;

  // Ensure the database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const versionConfig = VersionList.find(
    (v) => v.nodeBindings === nodeBindings,
  );
  if (!versionConfig) {
    throw new Error(`SDK version ${nodeBindings} not found in VersionList`);
  }
  const ClientClass = versionConfig.Client;
  let client = null;

  const signer = createSigner(walletKey);

  // D14N support: For bindings 1.6+, use d14nHost parameter instead of apiUrl
  // Parse version carefully to handle rc versions
  const versionNumber = parseFloat(nodeBindings.split('-')[0]);
  const supportsD14N = versionNumber >= 1.6;
  
  const clientOptions: any = {
    dbEncryptionKey,
    dbPath,
    env: env as unknown as XmtpEnv,
    loggingLevel,
    appVersion: APP_VERSION,
    codecs: [new ReactionCodec(), new ReplyCodec()],
  };

  // Add D14N or legacy API URL parameter based on SDK version
  if (supportsD14N && apiUrl) {
    clientOptions.d14nHost = apiUrl; // For 1.6+: Use d14nHost for D14N gateway
    console.log(
      `[SDK ${nodeBindings}] Using D14N mode with gateway: ${apiUrl}`,
    );
  } else if (apiUrl) {
    clientOptions.apiUrl = apiUrl; // For older versions: Use apiUrl
    console.log(
      `[SDK ${nodeBindings}] Using legacy apiUrl override: ${apiUrl}`,
    );
  } else {
    console.log(
      `[SDK ${nodeBindings}] Using default network endpoint for env: ${env}`,
    );
  }

  try {
    // @ts-expect-error - SDK version compatibility
    client = await ClientClass.create(signer, clientOptions);
  } catch (error) {
    // If database file is corrupted, try using a different path
    if (
      error instanceof Error &&
      error.message.includes("Unable to open the database file")
    ) {
      console.log(
        `Database file corrupted, trying alternative path: ${dbPath}`,
      );

      // Try with a different database path by adding a timestamp
      const timestamp = Date.now();
      const alternativeDbPath = `${dbPath}-${timestamp}`;

      console.log(`Using alternative database path: ${alternativeDbPath}`);

      // Try to create the client with the alternative path
      const retryOptions: any = {
        dbEncryptionKey,
        dbPath: alternativeDbPath,
        env,
        loggingLevel,
        appVersion: APP_VERSION,
        codecs: [new ReactionCodec(), new ReplyCodec()],
      };

      // Add D14N or legacy API URL parameter based on SDK version
      if (supportsD14N && apiUrl) {
        retryOptions.d14nHost = apiUrl;
        console.log(
          `[SDK ${nodeBindings}] Retry: Using D14N mode with gateway: ${apiUrl}`,
        );
      } else if (apiUrl) {
        retryOptions.apiUrl = apiUrl;
        console.log(
          `[SDK ${nodeBindings}] Retry: Using legacy apiUrl override: ${apiUrl}`,
        );
      } else {
        console.log(
          `[SDK ${nodeBindings}] Retry: Using default network endpoint for env: ${env}`,
        );
      }

      // @ts-expect-error - SDK version compatibility
      client = await ClientClass.create(signer, retryOptions);
    } else {
      throw error;
    }
  }

  if (!client) {
    throw new Error(`Failed to create client for SDK version ${nodeBindings}`);
  }

  return client;
};

/**
 * Check if a version string is valid
 */
export function isValidSdkVersion(version: string): boolean {
  return VersionList.some((v) => v.nodeBindings === version);
}

export function getDefaultSdkVersion(): string {
  return getActiveVersion().nodeBindings;
}

/**
 * Get SDK versions for testing (respects TEST_VERSIONS env var)
 */
export function getSdkVersionsForTesting(): string[] {
  let sdkVersions = [getDefaultSdkVersion()];

  if (process.env.TEST_VERSIONS) {
    sdkVersions = VersionList.slice(0, parseInt(process.env.TEST_VERSIONS)).map(
      (v) => v.nodeBindings,
    );
  }

  return sdkVersions;
}

