import { execSync, execFileSync } from "child_process";
import * as netem from "./netem";
import * as iptables from "./iptables";

export class DockerContainer {
  name: string;
  ip: string;
  pid: string;
  veth: string;

  constructor(name: string) {
    DockerContainer.validateDependencies();
    this.name = name;
    this.ip = this.getIP();
    this.pid = this.getPID();
    this.veth = this.getVeth();
  }

  private getIP(): string {
    return this.sh(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${this.name}`);
  }

  private getPID(): string {
    return this.sh(`docker inspect -f '{{.State.Pid}}' ${this.name}`);
  }

  private getVeth(): string {
    try {
      const pid = this.pid;
      const ifLine = this.sh(`sudo nsenter -t ${pid} -n ip link show eth0`);
      const match = ifLine.match(/eth0@if(\d+):/);
      if (!match) throw new Error(`Could not extract ifindex from: ${ifLine}`);

      const ifIndex = parseInt(match[1], 10);
      const linksOutput = this.sh("ip -o link");
      const lines = linksOutput.split("\n");

      const vethLine = lines.find((line) => line.startsWith(`${ifIndex}: `));
      if (!vethLine) throw new Error(`Could not find host veth interface for ifindex ${ifIndex}`);

      const iface = vethLine.split(":")[1].trim().split("@")[0];
      return iface;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[sh] getVeth() failed for ${this.name}: ${msg}`);
    }
  }

  sh(cmd: string, expectFailure = false): string {
    console.log(`[sh] Executing: ${cmd}`);
    try {
      const output = execSync(cmd, { stdio: ["inherit", "pipe", "pipe"] }).toString().trim();
      return output;
    } catch (e) {
      if (expectFailure) {
        console.log(`[sh] Shell command failed as expected: ${cmd}`);
        return "";
      }

      if (e instanceof Error && "stderr" in e) {
        const stderr = (e as { stderr?: Buffer }).stderr?.toString().trim();
        console.error(`[sh] Error output: ${stderr}`);
      }

      throw new Error(`Command failed: ${cmd}\n${e instanceof Error ? e.message : String(e)}`);
    }
  }

  ping(target: DockerContainer, count = 3, expectFailure = false): void {
    console.log(`[sh] Pinging ${target.name} (${target.ip}) from ${this.name}...`);
    try {
      const output = execSync(`docker exec ${this.name} ping -c ${count} ${target.ip}`, {
        stdio: "pipe"
      }).toString();
      const summary = output.split("\n").find((line) => line.includes("rtt") || line.includes("round-trip"));
      if (summary !== undefined) {
        console.log(`[sh] ${summary}`);
      } else {
        console.log(`[sh] ${output}`);
      }
    } catch (e) {
      if (expectFailure) {
        console.log("[iptables] Ping failed as expected");
      } else {
        console.error(`[sh] Ping failed unexpectedly: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  addLatency(ms: number): void {
    netem.applyLatency(this, ms);
  }

  addJitter(delay: number, jitter: number): void {
    netem.applyJitter(this, delay, jitter);
  }

  addLoss(percent: number): void {
    netem.applyLoss(this, percent);
  }

  blockOutboundTrafficToHost(): void {
    iptables.blackHoleToHost(this);
  }

  unblockToHost(): void {
    iptables.unblockToHost(this);
  }

  blockInboundFromHost(): void {
    iptables.blockFromHostTo(this);
  }

  clearLatency(): void {
    try {
      netem.clear(this);
    } catch {
      console.log(`[netem] No existing qdisc to clear on ${this.name}`);
    }
  }

  addFixedLatencyTo(other: DockerContainer, latencyMs: number): void {
    netem.applyBidirectionalLatency(this, other, latencyMs);
  }

  blockOutboundTrafficTo(target: DockerContainer): void {
    iptables.blockOutboundTraffic(this, target);
  }

  unblockOutboundTrafficTo(target: DockerContainer): void {
    iptables.unblockOutboundTraffic(this, target);
  }

  unblockFromHost(): void {
    iptables.unblockFromHostTo(this);
  }

  simulateBlackhole(others: DockerContainer[]): void {
    for (const other of others) {
      iptables.blackHoleTo(this, other);
    }
  }

  clearBlackhole(others: DockerContainer[]): void {
    for (const other of others) {
      iptables.unblockBlackHoleTo(this, other);
    }
  }

  simulateInterContainerBlackhole(): void {
    iptables.blackHoleInterContainer(this);
  }

  clearInterContainerBlackhole(): void {
    iptables.unblockInterContainer(this);
  }

  kill(): void {
    execFileSync("docker", ["kill", this.name], { stdio: "inherit" });
  }

  pause(): void {
    execFileSync("docker", ["pause", this.name], { stdio: "inherit" });
  }

  unpause(): void {
    execFileSync("docker", ["unpause", this.name], { stdio: "inherit" });
  }

  static listRunningXmtpNodes(): DockerContainer[] {
    const output = execSync(
      `docker ps --filter "ancestor=xmtp-node" --format "{{.Names}}"`
    ).toString().trim();
    if (!output) return [];
    return output.split("\n").map((name) => new DockerContainer(name));
  }

  static validateDependencies(): void {
    const dependencies = ["docker", "iptables", "tc"];
    for (const cmd of dependencies) {
      try {
        execSync(`command -v ${cmd}`, { stdio: "ignore" });
      } catch {
        throw new Error(`Dependency not found - please install: ${cmd}`);
      }
    }
  }

  static listByNamePrefix(prefix: string): DockerContainer[] {
    const output = execSync(`docker ps --format "{{.Names}}"`)
      .toString()
      .trim();
    if (!output) return [];
    return output
      .split("\n")
      .filter((name) => name.startsWith(prefix))
      .map((name) => new DockerContainer(name));
  }

}
