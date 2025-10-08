/**
 * Fluent Option Builders
 * 
 * React-like builder pattern for defining command options
 */

import type { OptionDefinition } from './types.js';

class OptionBuilder<T> {
  private def: OptionDefinition<T>;

  constructor(type: OptionDefinition<T>['type']) {
    this.def = { type } as OptionDefinition<T>;
  }

  description(desc: string): this {
    this.def.description = desc;
    return this;
  }

  default(value: T): this {
    this.def.default = value;
    this.def.required = false;
    return this;
  }

  required(): this {
    this.def.required = true;
    delete this.def.default;
    return this;
  }

  optional(): this {
    this.def.required = false;
    return this;
  }

  alias(shorthand: string): this {
    this.def.alias = shorthand;
    return this;
  }

  validate(fn: (value: T) => boolean | string): this {
    this.def.validate = fn;
    return this;
  }

  build(): OptionDefinition<T> {
    return this.def;
  }
}

class StringOptionBuilder extends OptionBuilder<string> {
  constructor() {
    super('string');
  }
}

class NumberOptionBuilder extends OptionBuilder<number> {
  constructor() {
    super('number');
  }

  min(value: number): this {
    const existingValidate = this.def.validate;
    this.def.validate = (v: number) => {
      const existingResult = existingValidate?.(v);
      if (typeof existingResult === 'string') return existingResult;
      if (existingResult === false) return false;
      return v >= value || `Must be at least ${value}`;
    };
    return this;
  }

  max(value: number): this {
    const existingValidate = this.def.validate;
    this.def.validate = (v: number) => {
      const existingResult = existingValidate?.(v);
      if (typeof existingResult === 'string') return existingResult;
      if (existingResult === false) return false;
      return v <= value || `Must be at most ${value}`;
    };
    return this;
  }
}

class BooleanOptionBuilder extends OptionBuilder<boolean> {
  constructor() {
    super('boolean');
  }
}

class EnumOptionBuilder<T extends readonly string[]> extends OptionBuilder<T[number]> {
  constructor(choices: T) {
    super('enum');
    this.def.choices = [...choices] as any;
  }
}

class ArrayOptionBuilder extends OptionBuilder<string[]> {
  constructor() {
    super('array');
  }

  separator(sep: string): this {
    (this.def as any).separator = sep;
    return this;
  }
}

/**
 * Option builder exports - use these to define command options
 */
export const option = {
  string: () => new StringOptionBuilder(),
  number: () => new NumberOptionBuilder(),
  boolean: () => new BooleanOptionBuilder(),
  enum: <T extends readonly string[]>(choices: T) => new EnumOptionBuilder(choices),
  array: () => new ArrayOptionBuilder(),
};
