// personas.ts
import { type Client, type XmtpEnv } from "@xmtp/node-sdk";
import { WorkerClient } from "./WorkerClient";
import "./worker";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const defaultValues = {
  amount: 5,
  timeout: 40000,
  version: "42",
  binding: "37",
  installationId: "a",
};

export interface Persona {
  name: string;
  installationId: string;
  version: string;
  dbPath: string;
  worker: WorkerClient | null;
  client: Client | null;
}

// Default personas as an enum
export enum DefaultPersonas {
  FABRI = "fabri",
  ELON = "elon",
  ALICE = "alice",
  BOB = "bob",
  JOE = "joe",
  CHARLIE = "charlie",
  DAVE = "dave",
  ROSALIE = "rosalie",
  EVE = "eve",
  FRANK = "frank",
  GRACE = "grace",
  HENRY = "henry",
  IVY = "ivy",
  JACK = "jack",
  KAREN = "karen",
  LARRY = "larry",
  MARY = "mary",
  NANCY = "nancy",
  OSCAR = "oscar",
  PAUL = "paul",
  QUINN = "quinn",
  RACHEL = "rachel",
  STEVE = "steve",
  TOM = "tom",
  URSULA = "ursula",
  VICTOR = "victor",
  WENDY = "wendy",
  XAVIER = "xavier",
  YOLANDA = "yolanda",
  ZACK = "zack",
  ADAM = "adam",
  BELLA = "bella",
  CARL = "carl",
  DIANA = "diana",
  ERIC = "eric",
  FIONA = "fiona",
  GEORGE = "george",
  HANNAH = "hannah",
  IAN = "ian",
  JULIA = "julia",
  KEITH = "keith",
  LISA = "lisa",
  MIKE = "mike",
  NINA = "nina",
  OLIVER = "oliver",
  PENNY = "penny",
  QUENTIN = "quentin",
  ROSA = "rosa",
  SAM = "sam",
  TINA = "tina",
  UMA = "uma",
  VINCE = "vince",
  WALT = "walt",
  XENA = "xena",
}

export interface PersonaBase {
  name: string;
  installationId: string;
  version: string;
}

export interface Persona extends PersonaBase {
  worker: WorkerClient;
  client: Client;
}

/**
 * Parses a descriptor string like "bobA41" into a Persona.
 */
export function parsePersonaDescriptor(
  descriptor: string,
  defaults: { installationId: string; version: string } = {
    installationId: defaultValues.installationId,
    version: defaultValues.versions,
  },
): { name: string; installationId: string; version: string } {
  console.time(`parsePersonaDescriptor:${descriptor}`);
  // Matches: lowercase letters for name, optional uppercase letter, optional digits.
  const regex = /^([a-z]+)([A-Z])?(\d+)?$/;
  const match = descriptor.match(regex);
  if (!match) {
    throw new Error(`Invalid persona descriptor: ${descriptor}`);
  }
  const [, baseName, inst, ver] = match;
  const result = {
    name: baseName,
    installationId: inst || defaults.installationId,
    version: ver || defaults.version,
  };
  console.timeEnd(`parsePersonaDescriptor:${descriptor}`);
  return result;
}

/**
 * Given an array of descriptor strings and an environment,
 * initialize a worker for each persona.
 */
export async function getPersonas(
  descriptors: string[],
  env: XmtpEnv,
): Promise<Persona[]> {
  console.time("getPersonas:total");

  // Create all worker instances in parallel first
  const personas = await Promise.all(
    descriptors.map((desc) => {
      const { name, installationId, version } = parsePersonaDescriptor(desc);
      // Create a base persona object without the worker
      const basePersona = { name, installationId, version };
      // Create the worker with just the base info
      const worker = new WorkerClient(basePersona, env);
      // Create the full persona object
      const persona = { ...basePersona, worker } as Persona;
      return persona;
    }),
  );

  // Then initialize all clients in parallel
  await Promise.all(
    personas.map(async (p) => {
      console.time(`getPersonas:initialize:${p.name}`);
      p.client = await p.worker.initialize();
      console.timeEnd(`getPersonas:initialize:${p.name}`);
    }),
  );

  console.timeEnd("getPersonas:total");
  return personas;
}
