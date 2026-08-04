/**
 * IRI construction and validation.
 *
 * Local names end up concatenated onto the ontology namespace, so they must not contain
 * characters that would break the resulting IRI or the Turtle/RDF-XML syntax that carries it.
 */

/** Characters that are never acceptable in a local name. */
const ILLEGAL_LOCAL_NAME = /[\s<>"{}|\\^`/#?&%[\]:,;()]/;

/** RDF/XML writes properties as XML element names, so a local name must be a valid NCName. */
const NCNAME_START = /^[A-Za-z_]/;

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateLocalName(localName: string): ValidationResult {
  const value = localName.trim();
  if (value.length === 0) {
    return { valid: false, message: 'Name cannot be empty.' };
  }
  if (ILLEGAL_LOCAL_NAME.test(value)) {
    return {
      valid: false,
      message: 'Name cannot contain spaces or any of < > " { } | \\ ^ ` / # ? & % [ ] : , ; ( )',
    };
  }
  if (!NCNAME_START.test(value)) {
    return { valid: false, message: 'Name must start with a letter or underscore.' };
  }
  return { valid: true };
}

/**
 * Best-effort repair of user input into a legal local name: strips illegal characters,
 * collapses separators and prefixes an underscore if it would otherwise start with a digit.
 * Returns an empty string when nothing usable remains, which callers treat as invalid.
 */
export function sanitizeLocalName(raw: string): string {
  const collapsed = raw
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[<>"{}|\\^`/#?&%[\]:,;()]/g, '');
  if (collapsed.length === 0) return '';
  return NCNAME_START.test(collapsed) ? collapsed : `_${collapsed}`;
}

/**
 * Camel-casing removes the underscores it joins on, which can expose a leading digit
 * (`_3Series` -> `3Series`). Re-applying the start guard keeps the result a legal NCName.
 */
function ensureLegalStart(name: string): string {
  if (!name) return '';
  return NCNAME_START.test(name) ? name : `_${name}`;
}

/** Turns a display phrase into a conventional class name: `used car` -> `UsedCar`. */
export function toClassLocalName(raw: string): string {
  const sanitized = sanitizeLocalName(raw);
  if (!sanitized) return '';
  return ensureLegalStart(
    sanitized
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(''),
  );
}

/** Turns a display phrase into a conventional property name: `offered by` -> `offeredBy`. */
export function toPropertyLocalName(raw: string): string {
  const sanitized = sanitizeLocalName(raw);
  if (!sanitized) return '';
  const parts = sanitized.split('_').filter(Boolean);
  const [first, ...rest] = parts;
  if (!first) return '';
  return ensureLegalStart(
    [
      first.charAt(0).toLowerCase() + first.slice(1),
      ...rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)),
    ].join(''),
  );
}

/**
 * An absolute IRI: a scheme followed by characters legal in an IRI. Anything containing a
 * space, quote or angle bracket is not an IRI and must be written as a literal instead —
 * emitting it as an IRI would produce a document no parser can read.
 */
export const ABSOLUTE_IRI_VALUE = /^[A-Za-z][A-Za-z0-9+.-]*:[^\s<>"{}|\\^`]*$/;

/** A namespace IRI additionally needs an authority, so `mailto:x` is not accepted. */
const ABSOLUTE_IRI = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s<>"{}|\\^`]+$/;

export function validateNamespaceIri(iri: string): ValidationResult {
  const value = iri.trim();
  if (value.length === 0) {
    return { valid: false, message: 'Base IRI cannot be empty.' };
  }
  if (!ABSOLUTE_IRI.test(value)) {
    return { valid: false, message: 'Base IRI must be absolute, e.g. https://example.org/auto/' };
  }
  return { valid: true };
}

/** Namespaces must end in `/` or `#` so that concatenation produces a sane IRI. */
export function normalizeNamespaceIri(iri: string): string {
  const value = iri.trim();
  if (!value) return value;
  return /[/#]$/.test(value) ? value : `${value}#`;
}

const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function validatePrefix(prefix: string): ValidationResult {
  const value = prefix.trim();
  if (value.length === 0) {
    return { valid: false, message: 'Prefix cannot be empty.' };
  }
  if (!PREFIX_PATTERN.test(value)) {
    return {
      valid: false,
      message: 'Prefix must be a letter followed by letters, digits, - or _.',
    };
  }
  return { valid: true };
}

/** The absolute IRI of an entity: namespace + local name. */
export function entityIri(namespaceIri: string, localName: string): string {
  return `${normalizeNamespaceIri(namespaceIri)}${localName}`;
}

/**
 * The ontology's own IRI. A namespace ends in `/` or `#`; the ontology resource itself is
 * conventionally that string without the trailing separator.
 */
export function ontologyIri(namespaceIri: string): string {
  return normalizeNamespaceIri(namespaceIri).replace(/[/#]$/, '');
}

/**
 * Finds a name not already taken, appending 2, 3, ... as needed.
 * Used when dropping a second `Class` on the canvas or duplicating a property.
 */
export function uniqueLocalName(desired: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(desired)) return desired;
  let counter = 2;
  while (used.has(`${desired}${counter}`)) counter += 1;
  return `${desired}${counter}`;
}
