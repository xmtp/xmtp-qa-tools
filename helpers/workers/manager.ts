import type { NestedPersonasStructure, Persona } from "@helpers/types";

export class NestedPersonas {
  private personas: NestedPersonasStructure;

  constructor(personas: NestedPersonasStructure) {
    this.personas = personas;
  }

  // Method to get the total number of personas
  public getLength(): number {
    let count = 0;
    for (const baseName in this.personas) {
      count += Object.keys(this.personas[baseName]).length;
    }
    return count;
  }

  public getVersion(): string {
    return this.personas[Object.keys(this.personas)[0]][
      Object.keys(this.personas[Object.keys(this.personas)[0]])[0]
    ].version;
  }

  getPersonas(): Persona[] {
    const allPersonas: Persona[] = [];
    for (const baseName in this.personas) {
      for (const installationId in this.personas[baseName]) {
        allPersonas.push(this.personas[baseName][installationId]);
      }
    }
    return allPersonas;
  }

  // Method to get a specific persona
  public get(
    baseName: string,
    installationId: string = "a",
  ): Persona | undefined {
    if (baseName.includes("-")) {
      const [name, installationId] = baseName.split("-");
      return this.personas[name][installationId];
    }
    console.log("baseName", this.personas, baseName, installationId);
    return this.personas[baseName][installationId];
  }
  public addWorker(
    baseName: string,
    installationId: string,
    persona: Persona,
  ): void {
    this.personas[baseName][installationId] = persona;
  }
  // Additional methods to manipulate or access personas can be added here
}
