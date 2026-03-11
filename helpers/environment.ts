import type { XmtpEnv } from "@xmtp/node-sdk";

export type ExtendedXmtpEnv = XmtpEnv | "testnet-staging" | "testnet-dev";

export interface ResolvedEnvironment {
  sdkEnv: XmtpEnv;
  gatewayHost?: string;
}

function testnetGatewayCandidates(env: ExtendedXmtpEnv): string[] {
  if (env === "testnet-staging") {
    return [
      "XMTP_GATEWAY_HOST_TESTNET_STAGING",
      "XMTP_GATEWAY_HOST_STAGING",
      "XMTP_GATEWAY_HOST",
    ];
  }

  if (env === "testnet-dev") {
    return [
      "XMTP_GATEWAY_HOST_TESTNET_DEV",
      "XMTP_GATEWAY_HOST_DEV",
      "XMTP_GATEWAY_HOST",
    ];
  }

  return [];
}

function resolveTestnetGatewayHost(env: ExtendedXmtpEnv): string | undefined {
  const candidates = testnetGatewayCandidates(env);
  for (const key of candidates) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function resolveEnvironment(env: ExtendedXmtpEnv): ResolvedEnvironment {
  if (env.startsWith("testnet")) {
    const gatewayHost = resolveTestnetGatewayHost(env);
    if (!gatewayHost) {
      const candidates = testnetGatewayCandidates(env);
      throw new Error(
        `Environment '${env}' requires a gateway host. Set one of: ${candidates.join(", ")}`,
      );
    }
    return {
      sdkEnv: "dev",
      gatewayHost,
    };
  }
  return { sdkEnv: env as XmtpEnv };
}

export const VALID_ENVIRONMENTS = [
  "local",
  "dev",
  "production",
  "testnet-staging",
  "testnet-dev",
];

export function isValidExtendedEnv(env: string): env is ExtendedXmtpEnv {
  return VALID_ENVIRONMENTS.includes(env);
}
