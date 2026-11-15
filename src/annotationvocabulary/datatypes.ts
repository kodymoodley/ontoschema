import { NAMESPACES } from './namespaces';

/**
 * The xsd datatypes an attribute can have: every one that RDF recommends, grouped as RDF does.
 *
 * Taken from the table in RDF 1.1 Concepts, section 5.1 ("The XML Schema Built-in Datatypes"),
 * in its order and under its headings, a little shortened to fit a dropdown, so the list can be
 * checked against the spec line by line.
 * The spec says the other built-in types should not be used in RDF -- `QName` and `ENTITY` need
 * an XML document around them, `ID` and `IDREF` point within one, `NOTATION` is not for direct
 * use, and `IDREFS`, `ENTITIES` and `NMTOKENS` are lists -- so they are not offered, and a file
 * that uses one has it rewritten to `string` on opening, as with any other range not offered.
 */
export const XSD_DATATYPE_GROUPS = [
  { label: 'Core types', datatypes: ['string', 'boolean', 'decimal', 'integer'] },
  { label: 'Floating-point numbers', datatypes: ['double', 'float'] },
  { label: 'Time and date', datatypes: ['date', 'time', 'dateTime', 'dateTimeStamp'] },
  {
    label: 'Recurring and partial dates',
    datatypes: [
      'gYear',
      'gMonth',
      'gDay',
      'gYearMonth',
      'gMonthDay',
      'duration',
      'yearMonthDuration',
      'dayTimeDuration',
    ],
  },
  {
    label: 'Limited-range integers',
    datatypes: [
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
  },
  { label: 'Encoded binary data', datatypes: ['hexBinary', 'base64Binary'] },
  {
    label: 'Miscellaneous',
    datatypes: ['anyURI', 'language', 'normalizedString', 'token', 'NMTOKEN', 'Name', 'NCName'],
  },
] as const;

/** Every datatype offered, in the order the groups list them. */
export const XSD_DATATYPES = XSD_DATATYPE_GROUPS.flatMap((group) => group.datatypes);

export type XsdDatatype = (typeof XSD_DATATYPE_GROUPS)[number]['datatypes'][number];

export const DEFAULT_XSD_DATATYPE: XsdDatatype = 'string';

export function xsdDatatypeIri(datatype: XsdDatatype): string {
  return `${NAMESPACES.xsd}${datatype}`;
}

/**
 * A datatype as it is shown to a person: `string`, `integer`, `boolean`.
 *
 * The owner's decision, and the reasoning is worth keeping. Every xsd type stays on offer and
 * none is renamed — `integer` is not called *Whole number*, because translating them would cost
 * an expert the ability to recognise what they are choosing and gain a beginner very little.
 * What goes is the prefix, which is the only part that is jargon rather than an ordinary word.
 * The CURIE is still what gets written to the file; this is for reading.
 */
export function xsdDatatypeLabel(datatype: XsdDatatype): string {
  return datatype;
}

export function isXsdDatatype(value: string): value is XsdDatatype {
  return (XSD_DATATYPES as readonly string[]).includes(value);
}
