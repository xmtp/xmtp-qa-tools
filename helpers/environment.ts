import type { XmtpEnv } from "@xmtp/node-sdk";

export type ExtendedXmtpEnv = XmtpEnv | "testnet-staging" | "testnet-dev";

export interface ResolvedEnvironment {
  sdkEnv: XmtpEnv;
  gatewayHost?: string;
}

export function resolveEnvironment(env: ExtendedXmtpEnv): ResolvedEnvironment {
  if (env.startsWith("testnet")) {
    return {
      sdkEnv: "dev",
      gatewayHost: process.env.XMTP_GATEWAY_HOST,
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
