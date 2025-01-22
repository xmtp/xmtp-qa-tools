import { isAddress } from "viem";
import { JSDOM } from "jsdom";
import dns from "dns";
export const converseEndpointURL = "https://converse.xyz/profile/";

export type InfoCache = Map<string, UserInfo>;
export type ConverseProfile = {
  address: string | undefined;
  onXmtp: boolean;
  avatar: string | undefined;
  formattedName: string | undefined;
  name: string | undefined;
};
export type UserInfo = {
  ensDomain?: string | undefined;
  address?: string | undefined;
  webDomain?: string | undefined;
  preferredName: string | undefined;
  converseUsername?: string | undefined;
  ensInfo?: EnsData | undefined;
  avatar?: string | undefined;
  inboxId?: string | undefined;
  converseEndpoint?: string | undefined;
};

export interface EnsData {
  address?: string;
  avatar?: string;
  avatar_small?: string;
  converse?: string;
  avatar_url?: string;
  contentHash?: string;
  description?: string;
  ens?: string;
  ens_primary?: string;
  github?: string;
  resolverAddress?: string;
  twitter?: string;
  url?: string;
  wallets?: {
    eth?: string;
  };
}

class UserInfoCache {
  private static instance: UserInfoCache;
  private cache: InfoCache = new Map();

  private constructor() {}

  public static getInstance(): UserInfoCache {
    if (!UserInfoCache.instance) {
      UserInfoCache.instance = new UserInfoCache();
    }
    return UserInfoCache.instance;
  }

  get(key: string): UserInfo | undefined {
    return this.cache.get(key.toLowerCase());
  }

  set(key: string, data: UserInfo): void {
    this.cache.set(key.toLowerCase(), data);
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key.toLowerCase());
    } else {
      this.cache.clear();
    }
  }
}

// Use the singleton instance
export const cache = UserInfoCache.getInstance();

export const lookup = async (
  key: string | undefined,
  clientAddress?: string,
): Promise<UserInfo | undefined> => {
  let data: UserInfo = {
    ensDomain: undefined,
    address: undefined,
    converseUsername: undefined,
    ensInfo: undefined,
    avatar: undefined,
    converseEndpoint: undefined,
    inboxId: undefined,
    preferredName: undefined,
  };
  if (typeof key !== "string") {
    console.error("userinfo key must be a string");
    return data;
  }

  const cachedData = cache.get(key);
  if (cachedData) return cachedData;

  key = key?.toLowerCase();
  clientAddress = clientAddress?.toLowerCase();

  // Determine user information based on provided key
  if (isAddress(clientAddress || "")) {
    data.address = clientAddress;
  } else if (isAddress(key || "")) {
    data.address = key;
  } else if (key.includes(".eth")) {
    data.ensDomain = key;
  } else if (key.includes("https://") || key.includes("http://")) {
    data.webDomain = key;
  } else if (["@user", "@me", "@bot"].includes(key)) {
    data.address = clientAddress;
    data.ensDomain = key.replace("@", "") + ".eth";
    data.converseUsername = key.replace("@", "");
  } else if (key === "@alix") {
    data.address = "0x3a044b218BaE80E5b9E16609443A192129A67BeA".toLowerCase();
    data.converseUsername = "alix";
  } else if (key === "@bo") {
    data.address = "0xbc3246461ab5e1682baE48fa95172CDf0689201a".toLowerCase();
    data.converseUsername = "bo";
  } else {
    data.converseUsername = key;
  }

  data.preferredName = data.ensDomain || data.converseUsername || data.address;

  if (data.webDomain) {
    //data.address = await getEvmAddressFromDns(data.webDomain);
    if (!data.address) {
      data.address = await getEvmAddressFromHeaderTag(data.webDomain);
    }
  }

  const keyToUse =
    data.address?.toLowerCase() || data.ensDomain || data.converseUsername;

  if (!keyToUse) {
    console.log("Unable to determine a valid key for fetching user info.");
    return data;
  } else {
    // Fetch EVM address from DNS
    try {
      const response = await fetch(`https://ensdata.net/${keyToUse}`);
      if (response.status !== 200) {
        if (process.env.MSG_LOG === "true")
          console.log("- ENS data request failed for", keyToUse);
      } else {
        const ensData = (await response.json()) as EnsData;
        if (ensData) {
          data.ensInfo = ensData;
          data.ensDomain = ensData.ens || data.ensDomain;
          data.address =
            ensData.address?.toLowerCase() || data.address?.toLowerCase();
          data.avatar = ensData.avatar_url || data.avatar;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ENS data for ${keyToUse}`);
    }

    try {
      const converseEndpoint = `${converseEndpointURL}${data.converseUsername}`;
      const response = await fetchWithTimeout(
        converseEndpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ peer: data.converseUsername }),
        },
        5000,
      );
      if (!response?.ok) {
        console.error(
          `Converse profile request failed with status ${response?.status}`,
        );
      }
      const converseData = (await response?.json()) as ConverseProfile;
      if (converseData) {
        data.converseUsername =
          converseData.formattedName ||
          converseData.name ||
          data.converseUsername;
        data.address =
          converseData.address?.toLowerCase() || data.address?.toLowerCase();
        data.avatar = converseData.avatar || data.avatar;
        data.converseEndpoint = converseEndpoint;
      }
    } catch (error) {
      console.error("Failed to fetch Converse profile:", error);
    }

    data.preferredName = data.ensDomain || data.converseUsername || "Friend";
    cache.set(keyToUse, data);
    return data;
  }
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout = 5000,
) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    console.error("fetching");
  }
};

export async function getEvmAddressFromDns(
  domain: string,
): Promise<string | undefined> {
  try {
    try {
      const records = await new Promise((resolve, reject) => {
        dns.resolveTxt(domain, (err, records) => {
          if (err) {
            console.error("Failed to resolve TXT records:", err);
            return reject(err);
          }
          resolve(records);
        });
      });
      if (Array.isArray(records)) {
        for (const recordArray of records) {
          const recordText = recordArray.join("");
          console.log(`Found TXT record: ${recordText}`);

          const match = recordText.match(/^xmtp=(0x[a-fA-F0-9]+)/);
          if (match && match[1]) {
            return match[1];
          }
        }
      } else {
        console.error("Expected records to be an array, but got:", records);
      }
      return undefined;
    } catch (error) {
      console.error("Failed to resolve TXT records:", error);
      return undefined;
    }
  } catch (error) {
    console.error("Failed to fetch or parse the website:", error);
  }
}

export async function getEvmAddressFromHeaderTag(
  website: string,
): Promise<string | undefined> {
  try {
    const response = await fetch(website);
    const html = await response.text();
    const dom = new JSDOM(html);
    const metaTags = dom.window.document.getElementsByTagName("meta");
    for (let i = 0; i < metaTags.length; i++) {
      const metaTag = metaTags[i];
      const name = metaTag.getAttribute("name");
      const content = metaTag.getAttribute("content");

      if (name === "xmtp" && content) {
        const match = content.match(/^0x[a-fA-F0-9]+$/);
        if (match) {
          return match[0];
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch or parse the website:", error);
  }
  return undefined;
}
