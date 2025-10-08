/**
 * CLI Framework Types
 * 
 * A React-like declarative framework for building AI-discoverable CLI commands
 */

export type OptionType = 'string' | 'number' | 'boolean' | 'enum' | 'array';

export interface OptionDefinition<T = any> {
  type: OptionType;
  description?: string;
  default?: T;
  required?: boolean;
  choices?: T[];
  validate?: (value: T) => boolean | string;
  alias?: string;
}

export interface CommandOptions {
  [key: string]: OptionDefinition;
}

export interface CommandContext<T extends CommandOptions = CommandOptions> {
  options: ResolvedOptions<T>;
  rawArgs: string[];
  env: Record<string, string | undefined>;
}

export type ResolvedOptions<T extends CommandOptions> = {
  [K in keyof T]: T[K]['required'] extends true 
    ? InferOptionType<T[K]>
    : T[K]['default'] extends undefined
    ? InferOptionType<T[K]> | undefined
    : InferOptionType<T[K]>;
};

type InferOptionType<T> = T extends { type: 'string' } ? string
  : T extends { type: 'number' } ? number
  : T extends { type: 'boolean' } ? boolean
  : T extends { type: 'enum'; choices: infer C } ? C extends readonly (infer U)[] ? U : never
  : T extends { type: 'array' } ? string[]
  : never;

export interface CommandDefinition<T extends CommandOptions = CommandOptions> {
  name: string;
  description: string;
  options: T;
  examples?: string[];
  run: (context: CommandContext<T>) => Promise<any> | any;
}

export interface CommandResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}
