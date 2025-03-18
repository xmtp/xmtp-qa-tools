import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface NetworkStats {
  "DNS Lookup": number;
  "TCP Connection": number;
  "TLS Handshake": number;
  Processing: number;
  "Server Call": number;
}

export async function getNetworkStats(
  endpoint = "https://grpc.dev.xmtp.network:443",
): Promise<NetworkStats> {
  const curlCommand = `curl -s -w "\\n{\\"DNS Lookup\\": %{time_namelookup}, \\"TCP Connection\\": %{time_connect}, \\"TLS Handshake\\": %{time_appconnect}, \\"Server Call\\": %{time_starttransfer}}" -o /dev/null --max-time 10 ${endpoint}`;

  let stdout: string;

  try {
    const result = await execAsync(curlCommand);
    stdout = result.stdout;
  } catch (error: any) {
    // Even if curl returns an error, we might still have useful stdout
    if (error.stdout) {
      stdout = error.stdout;
      console.warn(
        `⚠️ Curl command returned error code ${error.code}, but stdout is available.`,
      );
    } else {
      console.error(`❌ Curl command failed without stdout:`, error);
      throw error; // rethrow if no stdout is available
    }
  }

  // Parse the JSON response
  const stats = JSON.parse(stdout.trim()) as NetworkStats;

  // Handle the case where Server Call time is 0
  if (stats["Server Call"] === 0) {
    console.warn(
      `Network request to ${endpoint} returned Server Call time of 0.`,
    );

    // Use a reasonable estimate
    stats["Server Call"] = stats["TLS Handshake"] + 0.1;
  }

  // Calculate processing time
  stats["Processing"] = stats["Server Call"] - stats["TLS Handshake"];

  // Ensure processing time is not negative
  if (stats["Processing"] < 0) {
    stats["Processing"] = 0;
  }

  return stats;
}
