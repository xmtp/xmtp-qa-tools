declare global {
  namespace NodeJS {
    interface ProcessEnv {
      WALLET_KEY: `0x${string}` | undefined;
      ENCRYPTION_KEY: string | undefined;
    }
  }
}

export {};
