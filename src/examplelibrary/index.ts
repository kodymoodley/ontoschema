import { automotive } from './automotive';
import { university } from './university';
import { insurance } from './insurance';
import { music } from './music';
import { recipes } from './recipes';
import type { Example } from './builder';

/**
 * Schemas to open and take apart. Each is small enough to hold in your head — no more than
 * fifteen classes and fifteen object properties — but big enough to have made real
 * modelling decisions, and each shows off something the editor does.
 *
 * Ordered gentlest first.
 */
export const EXAMPLES: readonly Example[] = [music, recipes, automotive, university, insurance];

export function findExample(key: string): Example | undefined {
  return EXAMPLES.find((example) => example.key === key);
}

export { buildExample, asExample, exampleSize } from './builder';
export type { Example, ExampleSpec, ClassSpec, RelationSpec } from './builder';
