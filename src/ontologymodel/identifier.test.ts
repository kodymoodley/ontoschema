import { describe, expect, it } from 'vitest';
import { isLegalLocalName } from '../../tests/fixtures/legalLocalName';
import {
  entityIri,
  normalizeNamespaceIri,
  ontologyIri,
  sanitizeLocalName,
  toClassLocalName,
  toPropertyLocalName,
  uniqueLocalName,
  validateNamespaceIri,
  validatePrefix,
} from './identifier';

/*
 * The oracle the property tests below lean on, checked itself: an oracle nobody verifies makes
 * every property that uses it vacuous, which is the failure this audit went looking for.
 *
 * It is a test helper rather than application code. Nothing in the app refuses a name — it
 * repairs one, and `sanitizeLocalName` coming back empty is how it detects the unrepairable.
 */
describe('isLegalLocalName, the oracle', () => {
  it('accepts ordinary names', () => {
    for (const good of ['Car', 'offeredBy', '_private', 'Model3']) {
      expect(isLegalLocalName(good), good).toBe(true);
    }
  });

  it('rejects the characters that would break an IRI or Turtle syntax', () => {
    for (const bad of [
      'Used Car',
      'Car/Model',
      'Car#Model',
      'Car?x',
      'Car&y',
      'a<b',
      'a>b',
      'a"b',
      'a{b',
      'a}b',
      'a|b',
      'a\\b',
      'a^b',
      'a`b',
      'a%b',
      'a[b',
      'a]b',
      'a:b',
      'a,b',
      'a;b',
      'a(b',
      'a)b',
    ]) {
      expect(isLegalLocalName(bad), `expected "${bad}" to be rejected`).toBe(false);
    }
  });

  it('rejects empty and whitespace-only input', () => {
    expect(isLegalLocalName('')).toBe(false);
    expect(isLegalLocalName('   ')).toBe(false);
  });

  it('rejects a name that does not start where an XML name may start', () => {
    expect(isLegalLocalName('3Series')).toBe(false);
    expect(isLegalLocalName('-dash')).toBe(false);
  });
});

describe('sanitizeLocalName', () => {
  it('strips illegal characters and collapses whitespace', () => {
    expect(sanitizeLocalName('  Used   Car ')).toBe('Used_Car');
    expect(sanitizeLocalName('Car/Model#2')).toBe('CarModel2');
  });

  it('prefixes an underscore rather than emitting an invalid leading digit', () => {
    expect(sanitizeLocalName('3Series')).toBe('_3Series');
  });

  it('returns empty when nothing usable survives', () => {
    expect(sanitizeLocalName('///')).toBe('');
    expect(sanitizeLocalName('   ')).toBe('');
  });

  it('always produces something that passes validation, or nothing at all', () => {
    for (const raw of ['Used Car', '3 series', 'a/b?c', '<<<>>>', 'Ω omega', '   ']) {
      const cleaned = sanitizeLocalName(raw);
      if (cleaned) expect(isLegalLocalName(cleaned), `for input "${raw}"`).toBe(true);
    }
  });
});

describe('naming conventions', () => {
  it('upper-camel-cases class names', () => {
    expect(toClassLocalName('used car')).toBe('UsedCar');
    expect(toClassLocalName('Dealership')).toBe('Dealership');
    expect(toClassLocalName('electric vehicle charger')).toBe('ElectricVehicleCharger');
  });

  it('lower-camel-cases property names', () => {
    expect(toPropertyLocalName('offered by')).toBe('offeredBy');
    expect(toPropertyLocalName('Has Part')).toBe('hasPart');
    expect(toPropertyLocalName('price')).toBe('price');
  });

  it('returns empty for unusable input rather than inventing a name', () => {
    expect(toClassLocalName('   ')).toBe('');
    expect(toPropertyLocalName('///')).toBe('');
  });

  it('keeps the result a legal NCName when camel-casing would expose a leading digit', () => {
    expect(toClassLocalName('_3Series')).toBe('_3Series');
    expect(toClassLocalName('3 series')).toBe('_3Series');
    expect(toPropertyLocalName('_2ndOwner')).toBe('_2ndOwner');
  });

  it('never produces a name that fails validation', () => {
    const inputs = ['used car', '3 series', '_3Series', 'a/b?c', 'HAS PART', 'x', '  9  '];
    for (const raw of inputs) {
      for (const produced of [toClassLocalName(raw), toPropertyLocalName(raw)]) {
        if (produced) expect(isLegalLocalName(produced), `for input "${raw}"`).toBe(true);
      }
    }
  });
});

describe('uniqueLocalName', () => {
  it('returns the name when free', () => {
    expect(uniqueLocalName('Car', ['Dealership'])).toBe('Car');
  });

  it('appends the first free numeric suffix', () => {
    expect(uniqueLocalName('Car', ['Car'])).toBe('Car2');
    expect(uniqueLocalName('Car', ['Car', 'Car2', 'Car3'])).toBe('Car4');
  });
});

describe('namespace handling', () => {
  it('requires an absolute base IRI', () => {
    expect(validateNamespaceIri('https://example.org/auto/').valid).toBe(true);
    expect(validateNamespaceIri('example.org/auto').valid).toBe(false);
    expect(validateNamespaceIri('').valid).toBe(false);
  });

  it('appends a hash when the namespace has no terminator', () => {
    expect(normalizeNamespaceIri('https://example.org/auto')).toBe('https://example.org/auto#');
    expect(normalizeNamespaceIri('https://example.org/auto/')).toBe('https://example.org/auto/');
    expect(normalizeNamespaceIri('https://example.org/auto#')).toBe('https://example.org/auto#');
  });

  it('builds entity IRIs by concatenation', () => {
    expect(entityIri('https://example.org/auto/', 'Car')).toBe('https://example.org/auto/Car');
    expect(entityIri('https://example.org/auto', 'Car')).toBe('https://example.org/auto#Car');
  });

  it('derives the ontology IRI by dropping the namespace terminator', () => {
    expect(ontologyIri('https://example.org/auto/')).toBe('https://example.org/auto');
    expect(ontologyIri('https://example.org/auto#')).toBe('https://example.org/auto');
  });
});

describe('validatePrefix', () => {
  it('accepts conventional prefixes and rejects malformed ones', () => {
    expect(validatePrefix('ex').valid).toBe(true);
    expect(validatePrefix('auto-v2').valid).toBe(true);
    expect(validatePrefix('2fast').valid).toBe(false);
    expect(validatePrefix('has space').valid).toBe(false);
    expect(validatePrefix('').valid).toBe(false);
  });
});
