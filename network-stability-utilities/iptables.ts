import { execSync } from "child_process";
import type { DockerContainer } from "./container";

export class Iptables {
    static blockOutboundTraffic(from: DockerContainer, to: DockerContainer): void {
        console.log(`[iptables] Blocking outbound traffic from ${from.name} to ${to.name}...`);
        execSync(`sudo nsenter -t ${from.pid} -n iptables -A OUTPUT -d ${to.ip} -j DROP`);
    }

    static unblockOutboundTraffic(from: DockerContainer, to: DockerContainer): void {
        console.log(`[iptables] Restoring outbound traffic from ${from.name} to ${to.name}...`);
        try {
            execSync(`sudo nsenter -t ${from.pid} -n iptables -D OUTPUT -d ${to.ip} -j DROP`);
        } catch (err) {
            console.warn(
                `[iptables] Could not delete iptables rule: ${err instanceof Error ? err.message : err
                }`
            );
        }
    }
}
