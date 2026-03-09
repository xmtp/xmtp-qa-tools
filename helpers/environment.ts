import type { XmtpEnv } from "@xmtp/node-sdk";

export type ExtendedXmtpEnv = XmtpEnv | "testnet-staging" | "testnet-dev";

export interface ResolvedEnvironment {
  sdkEnv: XmtpEnv;
  gatewayHost?: string;
}

function resolveTestnetGatewayHost(env: ExtendedXmtpEnv): string | undefined {
  if (env === "testnet-staging") {
    return (
      process.env.XMTP_GATEWAY_HOST_TESTNET_STAGING ||
      process.env.XMTP_GATEWAY_HOST_STAGING ||
      process.env.XMTP_GATEWAY_HOST
    );
  }

  if (env === "testnet-dev") {
    return (
      process.env.XMTP_GATEWAY_HOST_TESTNET_DEV ||
      process.env.XMTP_GATEWAY_HOST_DEV ||
      process.env.XMTP_GATEWAY_HOST
    );
  }

  return process.env.XMTP_GATEWAY_HOST;
}

export function resolveEnvironment(env: ExtendedXmtpEnv): ResolvedEnvironment {
  if (env.startsWith("testnet")) {
    return {
      sdkEnv: "dev",
      gatewayHost: resolveTestnetGatewayHost(env),
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
