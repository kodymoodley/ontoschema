import { toClassLocalName, toPropertyLocalName } from './identifier';
import type { Ontology } from './types';

/**
 * Whose a name is, and why a typed one cannot be used.
 *
 * Every class, relation and attribute is named in the schema's one namespace: the name is the
 * last part of its IRI, so two terms with one name would be one term in the file. A name a person
 * types is therefore either free, or already some term's -- and which term's decides what happens.
 * Typed for a new attribute, an attribute's name means that attribute, reused. Typed anywhere
 * else, a taken name is refused, in the same words wherever it was typed.
 *
 * The app used to settle a clash itself by appending a number, `name2`. Nobody meant that, and it
 * left two terms where there should have been one. Numbers stay only on names nobody typed, such
 * as a second `NewClass` dropped from the palette.
 */

export type NamedKind = 'class' | 'relation' | 'attribute';

export interface NameHolder {
  kind: NamedKind;
  id: string;
  localName: string;
}

const article = (kind: NamedKind) => (kind === 'attribute' ? 'an attribute' : `a ${kind}`);

/** A typed name as a term of this kind would be called: `used car` is the class `UsedCar`. */
export const cleanName = (kind: NamedKind, typed: string) =>
  kind === 'class' ? toClassLocalName(typed) : toPropertyLocalName(typed);

/** The term holding a name, leaving out the term being renamed. */
export function holderOfName(
  ontology: Ontology,
  localName: string,
  except?: string,
): NameHolder | undefined {
  const named = (kind: NamedKind) => (entity: { id: string; localName: string }) => ({
    kind,
    id: entity.id,
    localName: entity.localName,
  });
  return [
    ...ontology.classes.map(named('class')),
    ...ontology.relations.map(named('relation')),
    ...ontology.attributes.map(named('attribute')),
  ].find((holder) => holder.localName === localName && holder.id !== except);
}

/**
 * Why a typed name cannot be given to a term of this kind, or nothing when it can.
 *
 * `except` is the term being renamed, whose own name is not in its way.
 */
export function nameProblem(
  ontology: Ontology,
  kind: NamedKind,
  typed: string,
  except?: string,
): string | undefined {
  const name = cleanName(kind, typed);
  if (!name) return `${kind === 'attribute' ? 'An' : 'A'} ${kind} needs a name.`;
  const holder = holderOfName(ontology, name, except);
  if (!holder) return undefined;
  if (holder.kind === kind) return `${name} is already ${article(kind)}.`;
  return `${name} is already ${article(holder.kind)}, so ${article(kind)} cannot be called that too.`;
}
