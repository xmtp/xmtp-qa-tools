import type { DockerContainer } from "./container";

export class Netem {
    private constructor() { }

    static applyLatency(container: DockerContainer, latencyMs: number): void {
        console.log(`[netem] Clearing any existing qdisc on ${container.veth} (ok if none exists)...`);
        container.sh(`sudo tc qdisc del dev ${container.veth} root`, true);

        console.log(`[netem] Applying ${latencyMs}ms latency to ${container.veth}...`);
        container.sh(`sudo tc qdisc add dev ${container.veth} root netem delay ${latencyMs}ms`);
    }

    static applyJitter(container: DockerContainer, delay: number, jitter: number): void {
        this.clear(container);
        container.sh(`sudo tc qdisc add dev ${container.veth} root netem delay ${delay}ms ${jitter}ms`);
    }

    static applyLoss(container: DockerContainer, percent: number): void {
        this.clear(container);
        container.sh(`sudo tc qdisc add dev ${container.veth} root netem loss ${percent}%`);
    }

    static clear(container: DockerContainer): void {
        console.log(`[netem] Clearing latency from ${container.veth} (ok if already cleared)...`);
        container.sh(`sudo tc qdisc del dev ${container.veth} root`, true);
    }

    static applyBidirectionalLatency(a: DockerContainer, b: DockerContainer, ms: number): void {
        this.applyLatency(a, ms);
        this.applyLatency(b, ms);
    }
}
