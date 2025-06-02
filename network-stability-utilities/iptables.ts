import type { DockerContainer } from "./container";
import { execSync } from "child_process";

export function blockOutboundTraffic(from: DockerContainer, to: DockerContainer): void {
    console.log(`[iptables] Blocking traffic from ${from.name} to ${to.name}`);
    execSync(`sudo nsenter -t ${from.pid} -n iptables -A OUTPUT -d ${to.ip} -j DROP`);
}

export function unblockOutboundTraffic(from: DockerContainer, to: DockerContainer): void {
    console.log(`[iptables] Unblocking traffic from ${from.name} to ${to.name}`);
    try {
        execSync(`sudo nsenter -t ${from.pid} -n iptables -D OUTPUT -d ${to.ip} -j DROP`);
    } catch (e) {
        console.warn(`[iptables] Could not delete rule: ${e instanceof Error ? e.message : e}`);
    }
}
