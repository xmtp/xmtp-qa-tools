import type { Client } from "@helpers/types";
import type { WorkerClient } from "./main";

export type NestedAgentsStructure = Record<string, Record<string, Agent>>;

export const defaultNames = [
  "bob",
  "alice",
  "fabri",
  "elon",
  "joe",
  "charlie",
  "dave",
  "rosalie",
  "eve",
  "frank",
  "grace",
  "henry",
  "ivy",
  "jack",
  "karen",
  "larry",
  "mary",
  "nancy",
  "oscar",
  "paul",
  "quinn",
  "rachel",
  "steve",
  "tom",
  "ursula",
  "victor",
  "wendy",
  "xavier",
  "yolanda",
  "zack",
  "adam",
  "bella",
  "carl",
  "diana",
  "eric",
  "fiona",
  "george",
  "hannah",
  "ian",
  "julia",
  "keith",
  "lisa",
  "mike",
  "nina",
  "oliver",
  "penny",
  "quentin",
  "rosa",
  "sam",
  "tina",
  "uma",
  "vince",
  "walt",
  "xena",
  "yara",
  "zara",
  "guada",
  //max 61
];

export interface Agent {
  name: string;
  installationId: string;
  version: string;
  dbPath: string;
  worker: WorkerClient;
  client: Client;
}

export interface AgentBase {
  name: string;
  folder: string;
  walletKey: string;
  encryptionKey: string;
  testName: string;
}

export interface Agent extends AgentBase {
  worker: WorkerClient;
  dbPath: string;
  client: Client;
  version: string;
  installationId: string;
  address: string;
}

export class AgentManager {
  private agents: NestedAgentsStructure;

  constructor(agents: NestedAgentsStructure) {
    this.agents = agents;
  }

  // Method to get the total number of personas
  public getLength(): number {
    let count = 0;
    for (const baseName in this.agents) {
      count += Object.keys(this.agents[baseName]).length;
    }
    return count;
  }
  getRandomCount(count: number): Agent[] {
    const allAgents = this.getAgents();
    return allAgents.sort(() => 0.5 - Math.random()).slice(0, count);
  }
  public getVersion(): string {
    return this.agents[Object.keys(this.agents)[0]][
      Object.keys(this.agents[Object.keys(this.agents)[0]])[0]
    ].version;
  }

  getAgents(): Agent[] {
    const allAgents: Agent[] = [];
    for (const baseName in this.agents) {
      for (const installationId in this.agents[baseName]) {
        allAgents.push(this.agents[baseName][installationId]);
      }
    }
    return allAgents;
  }

  // Method to get a specific persona
  public get(
    baseName: string,
    installationId: string = "a",
  ): Agent | undefined {
    if (baseName.includes("-")) {
      const [name, installationId] = baseName.split("-");
      return this.agents[name][installationId];
    }
    return this.agents[baseName][installationId];
  }
  public addAgent(
    baseName: string,
    installationId: string,
    agent: Agent,
  ): void {
    this.agents[baseName][installationId] = agent;
  }
}
