/**
 * IRI construction and validation.
 *
 * Local names end up concatenated onto the ontology namespace, so they must not contain
 * characters that would break the resulting IRI or the Turtle/RDF-XML syntax that carries it.
 */

/**
 * Where an XML name may begin: the `NameStartChar` production from XML 1.0, minus the colon
 * that a QName uses as its separator.
 *
 * Written out in full rather than as `[A-Za-z_]`, which is what it used to be. That was not a
 * simplification of this rule but a different and much narrower one, and it charged every name
 * not starting with an ASCII letter a leading underscore it did not need: `Ærøskøbing`,
 * `Ökonomie`, `Фамилия` and `日本語クラス` all came back with one. The two gaps in the Latin-1
 * ranges are deliberate — they hold the multiplication and division signs, which are symbols
 * rather than letters, and XML excludes them for that reason.
 */
const NCNAME_START =
  /^[A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]/u;

export interface ValidationResult {
  valid: boolean;
  message?: string;
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

/**
 * Splitting an IRI back into a namespace and a local name — the inverse of `entityIri`, and
 * here beside it for that reason. Reading a document needs this as much as writing one does,
 * and the model may not reach into the serialization layer to find it.
 *
 * The last `#` wins over the last `/`, which is what every RDF tool does: a hash IRI names a
 * term inside a document, a slash IRI names one at a path.
 */
export function namespaceOf(iri: string): string {
  const hash = iri.lastIndexOf('#');
  if (hash >= 0) return iri.slice(0, hash + 1);
  const slash = iri.lastIndexOf('/');
  if (slash >= 0) return iri.slice(0, slash + 1);
  return iri;
}

export function localNameOf(iri: string): string {
  return iri.slice(namespaceOf(iri).length);
}
