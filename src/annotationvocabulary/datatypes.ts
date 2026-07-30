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

export function xsdDatatypeCurie(datatype: XsdDatatype): string {
  return `xsd:${datatype}`;
}

export function isXsdDatatype(value: string): value is XsdDatatype {
  return (XSD_DATATYPES as readonly string[]).includes(value);
}
