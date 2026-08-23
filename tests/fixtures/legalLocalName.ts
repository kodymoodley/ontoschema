/**
 * Is this a local name that can be concatenated onto a namespace IRI and survive?
 *
 * A test oracle, and deliberately a **second, independent statement** of the rule rather than an
 * import of the one the code uses. The properties it checks — that whatever `sanitizeLocalName`
 * and `toClassLocalName` produce is usable — mean nothing if the check shares the constant the
 * producer strips by. Written from the requirement instead: a name goes into an IRI and into
 * Turtle and RDF/XML, so it must not carry a character that ends the name early there, and it
 * must start where an XML name may start.
 *
 * It lives here rather than in `src/` because nothing in the application asks this question. The
 * app repairs a name instead of refusing it — `Used car` becomes `UsedCar` — and the one case it
 * does refuse, a name with nothing usable left, it detects by the repair coming back empty.
 *
 * Listed one character at a time rather than as a regex or a run of escapes. Writing it the
 * compact way cost an hour once: a lost backslash left `a\\b` passing as legal, and the test that
 * should have caught it was the one being written.
 */
const BREAKS_AN_IRI = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
  '<',
  '>',
  '"',
  '{',
  '}',
  '|',
  '\\',
  '^',
  '`',
  '/',
  '#',
  '?',
  '&',
  '%',
  '[',
  ']',
  ',',
  ';',
  '(',
  ')',
  ':',
]);

export function isLegalLocalName(name: string): boolean {
  if (name.length === 0 || name.trim() !== name) return false;
  for (const character of name) {
    if (BREAKS_AN_IRI.has(character)) return false;
  }
  return /^[A-Za-z_]/.test(name);
}
