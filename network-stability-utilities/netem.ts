import type { DockerContainer } from "./container";

export function applyLatency(
  container: DockerContainer,
  latencyMs: number,
): void {
  console.log(`[netem] Clearing existing qdisc on ${container.veth}`);
  container.sh(`sudo tc qdisc del dev ${container.veth} root`, true);
  container.sh(
    `sudo tc qdisc add dev ${container.veth} root netem delay ${latencyMs}ms`,
  );
}

export function applyJitter(
  container: DockerContainer,
  delay: number,
  jitter: number,
): void {
  clear(container);
  container.sh(
    `sudo tc qdisc add dev ${container.veth} root netem delay ${delay}ms ${jitter}ms`,
  );
}

export function applyLoss(container: DockerContainer, percent: number): void {
  clear(container);
  container.sh(
    `sudo tc qdisc add dev ${container.veth} root netem loss ${percent}%`,
  );
}

export function clear(container: DockerContainer): void {
  console.log(`[netem] Clearing latency from ${container.veth}`);
  container.sh(`sudo tc qdisc del dev ${container.veth} root`, true);
}

export function applyBidirectionalLatency(
  a: DockerContainer,
  b: DockerContainer,
  ms: number,
): void {
  applyLatency(a, ms);
  applyLatency(b, ms);
}

export function applyEgressLatency(container: DockerContainer, latencyMs: number): void {
  console.log(`[netem] Adding egress latency inside ${container.name}`);
  container.sh(`sudo nsenter -t ${container.pid} -n tc qdisc del dev eth0 root`, true);
  container.sh(`sudo nsenter -t ${container.pid} -n tc qdisc add dev eth0 root netem delay ${latencyMs}ms`);
}

export function applyEgressJitter(container: DockerContainer, delay: number, jitter: number): void {
  clearEgress(container);
  container.sh(`sudo nsenter -t ${container.pid} -n tc qdisc add dev eth0 root netem delay ${delay}ms ${jitter}ms`);
}

export function applyEgressLoss(container: DockerContainer, percent: number): void {
  clearEgress(container);
  container.sh(`sudo nsenter -t ${container.pid} -n tc qdisc add dev eth0 root netem loss ${percent}%`);
}

export function clearEgress(container: DockerContainer): void {
  console.log(`[netem] Clearing egress latency inside ${container.name}`);
  container.sh(`sudo nsenter -t ${container.pid} -n tc qdisc del dev eth0 root`, true);
}

