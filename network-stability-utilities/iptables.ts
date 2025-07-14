import { execSync } from "child_process";
import type { DockerContainer } from "./container";

export function blockOutboundTraffic(
  from: DockerContainer,
  to: DockerContainer,
): void {
  console.log(`[iptables] Blocking traffic from ${from.name} to ${to.name}`);
  execSync(
    `sudo nsenter -t ${from.pid} -n iptables -A OUTPUT -d ${to.ip} -j DROP`,
  );
}

export function unblockOutboundTraffic(
  from: DockerContainer,
  to: DockerContainer,
): void {
  console.log(`[iptables] Unblocking traffic from ${from.name} to ${to.name}`);
  try {
    execSync(
      `sudo nsenter -t ${from.pid} -n iptables -D OUTPUT -d ${to.ip} -j DROP`,
    );
  } catch (e) {
    console.warn(
      `[iptables] Could not delete rule: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function blackHoleTo(
  target: DockerContainer,
  other: DockerContainer,
): void {
  console.log(
    `[iptables] Blackholing traffic between ${target.name} and ${other.name}`,
  );
  blockOutboundTraffic(target, other);
  blockOutboundTraffic(other, target);
}

export function unblockBlackHoleTo(
  target: DockerContainer,
  other: DockerContainer,
): void {
  console.log(
    `[iptables] Removing blackhole between ${target.name} and ${other.name}`,
  );
  unblockOutboundTraffic(target, other);
  unblockOutboundTraffic(other, target);
}

export function unblockFromHostTo(container: DockerContainer): void {
  console.log(
    `[iptables] Removing blackhole rule from host to ${container.name} (IP ${container.ip})`,
  );
  try {
    execSync(`sudo iptables -D OUTPUT -d ${container.ip} -j DROP`);
  } catch (e) {
    console.warn(
      `[iptables] Could not delete host rule: ${e instanceof Error ? e.message : String(e)}`,
    );
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
    console.warn(
      `[iptables] Could not delete rule: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function blockFromHostTo(container: DockerContainer): void {
  console.log(
    `[iptables] Blocking traffic from host to ${container.name} (IP ${container.ip})`,
  );
  execSync(`sudo iptables -A OUTPUT -d ${container.ip} -j DROP`);
}
