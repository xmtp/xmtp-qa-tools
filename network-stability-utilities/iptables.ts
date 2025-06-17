import type { DockerContainer } from "./container";
import { execSync } from "child_process";

function getGatewayIPFromContainer(container: DockerContainer): string {
  const route = container.sh(`ip route | grep default`).trim();
  const match = route.match(/default via ([0-9.]+) dev/);
  if (!match) {
    throw new Error(`Unable to parse gateway IP from route output: ${route}`);
  }
  return match[1];
}

export function blockOutboundTraffic(from: DockerContainer, to: DockerContainer): void {
  console.log(`[iptables] Blocking traffic from ${from.name} to ${to.name}`);
  execSync(`sudo nsenter -t ${from.pid} -n iptables -A OUTPUT -d ${to.ip} -j DROP`);
}

export function unblockOutboundTraffic(from: DockerContainer, to: DockerContainer): void {
  console.log(`[iptables] Unblocking traffic from ${from.name} to ${to.name}`);
  try {
    execSync(`sudo nsenter -t ${from.pid} -n iptables -D OUTPUT -d ${to.ip} -j DROP`);
  } catch (e) {
    console.warn(`[iptables] Could not delete rule: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function blackHoleTo(target: DockerContainer, other: DockerContainer): void {
  console.log(`[iptables] Blackholing traffic between ${target.name} and ${other.name}`);
  blockOutboundTraffic(target, other);
  blockOutboundTraffic(other, target);
}

export function unblockBlackHoleTo(target: DockerContainer, other: DockerContainer): void {
  console.log(`[iptables] Removing blackhole between ${target.name} and ${other.name}`);
  unblockOutboundTraffic(target, other);
  unblockOutboundTraffic(other, target);
}

export function unblockFromHostTo(container: DockerContainer): void {
  console.log(`[iptables] Removing blackhole rule from host to ${container.name} (IP ${container.ip})`);
  try {
    execSync(`sudo iptables -D OUTPUT -d ${container.ip} -j DROP`);
  } catch (e) {
    console.warn(`[iptables] Could not delete host rule: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function blackHoleToHost(container: DockerContainer): void {
  const hostIP = getGatewayIPFromContainer(container);
  console.log(`[iptables] Blackholing traffic from ${container.name} to host gateway ${hostIP}`);
  execSync(`sudo nsenter -t ${container.pid} -n iptables -A OUTPUT -d ${hostIP} -j DROP`);
}

export function unblockToHost(container: DockerContainer): void {
  const hostIP = getGatewayIPFromContainer(container);
  console.log(`[iptables] Removing blackhole rule from ${container.name} to host (${hostIP})`);
  try {
    execSync(`sudo nsenter -t ${container.pid} -n iptables -D OUTPUT -d ${hostIP} -j DROP`);
  } catch (e) {
    console.warn(`[iptables] Could not delete container-to-host rule: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function blockHostPort(port: number): void {
  console.log(`[iptables] Blocking host traffic to port ${port}`);
  execSync(`sudo iptables -A OUTPUT -p tcp --dport ${port} -j DROP`);
}

export function unblockHostPort(port: number): void {
  console.log(`[iptables] Unblocking host traffic to port ${port}`);
  try {
    execSync(`sudo iptables -D OUTPUT -p tcp --dport ${port} -j DROP`);
  } catch (e) {
    console.warn(`[iptables] Could not delete rule: ${e instanceof Error ? e.message : String(e)}`);
  }
}
export function blackHoleInterContainer(container: DockerContainer): void {
  const ip = container.ip;
  console.log(`[iptables] DROP all to/from ${container.name} (${ip}) in DOCKER-USER`);
  execSync(`sudo iptables -I DOCKER-USER -d ${ip} -j DROP`);
  execSync(`sudo iptables -I DOCKER-USER -s ${ip} -j DROP`);
}

export function blockFromHostTo(container: DockerContainer): void {
  console.log(`[iptables] Blocking traffic from host to ${container.name} (IP ${container.ip})`);
  execSync(`sudo iptables -A OUTPUT -d ${container.ip} -j DROP`);
}


