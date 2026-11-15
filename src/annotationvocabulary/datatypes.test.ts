import { describe, expect, it } from 'vitest';
import {
  XSD_DATATYPES,
  XSD_DATATYPE_GROUPS,
  isXsdDatatype,
  xsdDatatypeDescription,
  xsdDatatypeIri,
  xsdDatatypeLabel,
} from './datatypes';

/**
 * The datatypes an attribute can have, held to the table in RDF 1.1 Concepts, section 5.1
 * (https://www.w3.org/TR/rdf11-concepts/#xsd-datatypes). Written out here from the spec rather
 * than derived from the code, so a change to the list has to be a change to this test as well.
 */
const RDF_RECOMMENDED: Record<string, string[]> = {
  'Core types': ['string', 'boolean', 'decimal', 'integer'],
  'Floating-point numbers': ['double', 'float'],
  'Time and date': ['date', 'time', 'dateTime', 'dateTimeStamp'],
  'Recurring and partial dates': [
    'gYear',
    'gMonth',
    'gDay',
    'gYearMonth',
    'gMonthDay',
    'duration',
    'yearMonthDuration',
    'dayTimeDuration',
  ],
  'Limited-range integers': [
    'byte',
    'short',
    'int',
    'long',
    'unsignedByte',
    'unsignedShort',
    'unsignedInt',
    'unsignedLong',
    'positiveInteger',
    'nonNegativeInteger',
    'negativeInteger',
    'nonPositiveInteger',
  ],
  'Encoded binary data': ['hexBinary', 'base64Binary'],
  Miscellaneous: ['anyURI', 'language', 'normalizedString', 'token', 'NMTOKEN', 'Name', 'NCName'],
};

/** The built-in types the same section says SHOULD NOT be used in RDF. */
const UNSUITABLE = ['QName', 'ENTITY', 'ID', 'IDREF', 'NOTATION', 'IDREFS', 'ENTITIES', 'NMTOKENS'];

describe('the datatypes an attribute can have', () => {
  it('are the ones RDF recommends, grouped and ordered as the spec groups them', () => {
    expect(
      Object.fromEntries(XSD_DATATYPE_GROUPS.map((group) => [group.label, [...group.datatypes]])),
    ).toEqual(RDF_RECOMMENDED);
  });

  it('are all 39 of them, each once, in the order the groups list them', () => {
    expect(XSD_DATATYPES).toEqual(Object.values(RDF_RECOMMENDED).flat());
    expect(new Set(XSD_DATATYPES).size).toBe(39);
  });

  it('leave out the types the spec says not to use', () => {
    for (const unsuitable of UNSUITABLE) expect(isXsdDatatype(unsuitable), unsuitable).toBe(false);
  });

  it('are named in full in a file, and shown by their own name', () => {
    expect(xsdDatatypeIri('nonNegativeInteger')).toBe(
      'http://www.w3.org/2001/XMLSchema#nonNegativeInteger',
    );
    expect(xsdDatatypeLabel('gYearMonth')).toBe('gYearMonth');
  });
});

describe('what each datatype says about itself', () => {
  it('describes every datatype on offer, in a sentence of its own', () => {
    const descriptions = XSD_DATATYPES.map((datatype) => xsdDatatypeDescription(datatype));
    for (const [index, description] of descriptions.entries()) {
      expect(description, XSD_DATATYPES[index]).toMatch(/^\S.*\.$/);
    }
    // Copied text would tell two types apart by nothing.
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('gives an example written as it appears in a file', () => {
    expect(xsdDatatypeDescription('gMonthDay')).toContain('--11-15');
    expect(xsdDatatypeDescription('dayTimeDuration')).toContain('P2DT3H');
  });
});
