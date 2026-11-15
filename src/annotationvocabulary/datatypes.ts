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

/**
 * What each datatype holds, in a line, with an example of a value: shown as a tooltip wherever a
 * type is chosen. The names stay as they are (see `xsdDatatypeLabel`); this is what lets someone
 * who does not know `gMonthDay` or `NCName` choose one anyway. Examples are written the way the
 * value appears in a file.
 */
const DESCRIPTIONS: Record<XsdDatatype, string> = {
  string: 'Any text, such as "Hello".',
  boolean: 'true or false.',
  decimal:
    'An exact decimal number, such as 12.50. Use it for money and other values that must not be rounded.',
  integer: 'A whole number of any size, positive or negative, such as -3 or 42.',

  double: 'A 64-bit floating-point number, such as 6.022E23. Approximate, so not for money.',
  float: 'A 32-bit floating-point number, such as 3.14. Less precise than double.',

  date: 'A calendar date, such as 2026-11-15, with an optional time zone.',
  time: 'A time of day, such as 14:30:00, with an optional time zone.',
  dateTime: 'A date and time, such as 2026-11-15T14:30:00, with an optional time zone.',
  dateTimeStamp: 'A date and time that must include its time zone, such as 2026-11-15T14:30:00Z.',

  gYear: 'A year, such as 2026.',
  gMonth: 'A month of any year, such as --11 for November.',
  gDay: 'A day of any month, such as ---15 for the 15th.',
  gYearMonth: 'A month of a particular year, such as 2026-11.',
  gMonthDay: 'A day of a month in any year, such as --11-15 for 15 November.',
  duration:
    'A length of time in years, months, days, hours, minutes and seconds, such as P1Y2M3DT4H.',
  yearMonthDuration: 'A length of time in years and months only, such as P1Y6M.',
  dayTimeDuration: 'A length of time in days, hours, minutes and seconds only, such as P2DT3H.',

  byte: 'A whole number from -128 to 127.',
  short: 'A whole number from -32,768 to 32,767.',
  int: 'A whole number from -2,147,483,648 to 2,147,483,647.',
  long: 'A whole number from -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807.',
  unsignedByte: 'A whole number from 0 to 255.',
  unsignedShort: 'A whole number from 0 to 65,535.',
  unsignedInt: 'A whole number from 0 to 4,294,967,295.',
  unsignedLong: 'A whole number from 0 to 18,446,744,073,709,551,615.',
  positiveInteger: 'A whole number of 1 or more.',
  nonNegativeInteger: 'A whole number of 0 or more.',
  negativeInteger: 'A whole number of -1 or less.',
  nonPositiveInteger: 'A whole number of 0 or less.',

  hexBinary: 'Binary data written in hexadecimal, such as 0FB7.',
  base64Binary: 'Binary data written in Base64, such as R0lGODlh.',

  anyURI: 'A web address or other URI, such as https://example.org/page.',
  language: 'A language tag, such as en, nl or pt-BR.',
  normalizedString: 'Text with no line breaks or tabs.',
  token: 'Text with no line breaks or tabs, no spaces at either end, and no double spaces.',
  NMTOKEN: 'A single word of letters, digits and . - _ : with no spaces, such as ISO-9001.',
  Name: 'A name that starts with a letter, _ or :, followed by letters, digits and . - _ :, such as xml:lang.',
  NCName: 'A name like Name but without colons, such as productCode.',
};

export function xsdDatatypeDescription(datatype: XsdDatatype): string {
  return DESCRIPTIONS[datatype];
}

export function isXsdDatatype(value: string): value is XsdDatatype {
  return (XSD_DATATYPES as readonly string[]).includes(value);
}
