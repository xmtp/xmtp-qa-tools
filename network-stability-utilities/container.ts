import { execSync } from "child_process";
import { Netem } from "./netem";
import { Iptables } from "./iptables";

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

    private sh(cmd: string, expectFailure: boolean = false): string {
        console.log(`[sh] Executing: ${cmd}`);
        try {
            const output = execSync(cmd, { stdio: ['inherit', 'pipe', 'pipe'] }).toString().trim();
            //console.log(`[sh] Output: ${output}`);
            return output;
        } catch (e) {
            if (expectFailure) {
                console.log(`[sh] Shell command failed as expected: ${cmd}`);
                return "";
            }
    
            if (e instanceof Error && 'stderr' in e) {
                const stderr = (e as any).stderr?.toString().trim();
                console.error(`[sh] Error output: ${stderr}`);
            }
    
            throw new Error(`Command failed: ${cmd}\n${e instanceof Error ? e.message : String(e)}`);
        }
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
            const linksOutput = this.sh(`ip -o link`);
            const lines = linksOutput.split("\n");

            const vethLine = lines.find(line => line.startsWith(`${ifIndex}: `));
            if (!vethLine) throw new Error(`Could not find host veth interface for ifindex ${ifIndex}`);

            const iface = vethLine.split(":")[1].trim().split("@")[0];
            return iface;
        } catch (e) {
            throw new Error(`[sh] getVeth() failed for ${this.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    ping(target: DockerContainer, count: number = 3, expectFailure: boolean = false): void {
        console.log(`[sh] Pinging ${target.name} (${target.ip}) from ${this.name}...`);
        try {
            const output = execSync(`docker exec ${this.name} ping -c ${count} ${target.ip}`, { stdio: "pipe" }).toString();
            const summary = output.split("\n").find(line => line.includes("rtt") || line.includes("round-trip"));
            console.log(`[sh] ${summary || output}`);
        } catch (e) {
            if (expectFailure) {
                console.log(`[iptables] Ping failed as expected`);
            } else {
                console.error(`[sh] Ping failed unexpectedly: ${e instanceof Error ? e.message : e}`);
            }
        }
    }

    addLatency(ms: number): void {
        Netem.applyLatency(this, ms);
    }

    addJitter(delay: number, jitter: number): void {
        Netem.applyJitter(this, delay, jitter);
    }

    addLoss(percent: number): void {
        Netem.applyLoss(this, percent);
    }

    clearLatency(): void {
        try {
            Netem.clear(this);
        } catch {
            console.log(`[netem] No existing qdisc to clear on ${this.name}`);
        }
    }

    async addFixedLatencyTo(other: DockerContainer, latencyMs: number): Promise<void> {
        await Netem.applyBidirectionalLatency(this, other, latencyMs);
    }

    blockOutboundTrafficTo(target: DockerContainer): void {
        Iptables.blockOutboundTraffic(this, target);
    }

    unblockOutboundTrafficTo(target: DockerContainer): void {
        Iptables.unblockOutboundTraffic(this, target);
    }

    blackHoleTo(target: DockerContainer): void {
        Iptables.blockOutboundTraffic(this, target);
    }

    kill(): void {
        execSync(`docker kill ${this.name}`);
    }

    pause(): void {
        execSync(`docker pause ${this.name}`);
    }

    unpause(): void {
        execSync(`docker unpause ${this.name}`);
    }

    static listRunningXmtpNodes(): DockerContainer[] {
        const output = execSync(`docker ps --filter "ancestor=xmtp-node" --format "{{.Names}}"`).toString().trim();
        if (!output) return [];
        return output.split("\n").map(name => new DockerContainer(name));
    }

    static validateDependencies(): void {
        const dependencies = ["docker", "iptables", "tc"];
    
        for (const cmd of dependencies) {
            try {
                execSync(`command -v ${cmd}`, { stdio: "ignore" });
            } catch (e) {
                throw new Error(`Dependency not found - please install: ${cmd}`);
            }
        }
    }

    static listByNamePrefix(prefix: string): DockerContainer[] {
        const output = execSync(`docker ps --format "{{.Names}}" | grep ^${prefix}`).toString().trim();
        if (!output) return [];
        return output.split("\n").map(name => new DockerContainer(name));
    }
}