import type { DockerContainer } from "./container";
import { execSync } from "child_process";

export namespace Iptables {
    export function blockOutboundTraffic(from: DockerContainer, to: DockerContainer): void {
        console.log(`[iptables] Blocking outbound traffic from ${from.name} to ${to.name}...`);
        execSync(`sudo nsenter -t ${from.pid} -n iptables -A OUTPUT -d ${to.ip} -j DROP`);
    }

    export function unblockOutboundTraffic(from: DockerContainer, to: DockerContainer): void {
        console.log(`[iptables] Restoring outbound traffic from ${from.name} to ${to.name}...`);
        try {
            execSync(`sudo nsenter -t ${from.pid} -n iptables -D OUTPUT -d ${to.ip} -j DROP`);
        } catch (e) {
            console.warn(`[iptables] Could not delete iptables rule: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
