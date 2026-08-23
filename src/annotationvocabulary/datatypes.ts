import { NAMESPACES } from './namespaces';

/** The xsd datatypes offered as ranges for datatype properties. */
export const XSD_DATATYPES = [
  'string',
  'integer',
  'decimal',
  'date',
  'dateTime',
  'boolean',
  'anyURI',
] as const;

export type XsdDatatype = (typeof XSD_DATATYPES)[number];

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
