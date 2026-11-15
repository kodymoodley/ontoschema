import {
  XSD_DATATYPE_GROUPS,
  xsdDatatypeDescription,
  xsdDatatypeLabel,
} from '../annotationvocabulary';

/**
 * The datatypes an attribute can have, as the options of a `<select>`: grouped as RDF groups
 * them, so thirty-nine entries read as seven short lists rather than one long one. Each says what
 * it holds when pointed at, which is how someone who has never met `gMonthDay` can choose one.
 *
 * A native list rather than a searchable picker. Typing a few letters already jumps to an entry,
 * the keyboard and screen readers know it, and a phone shows its own picker. One component,
 * because three places offer the choice -- the inspector, the row that adds an attribute, and the
 * class box -- and they should never offer different lists.
 */
export function DatatypeOptions() {
  return (
    <>
      {XSD_DATATYPE_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.datatypes.map((datatype) => (
            <option key={datatype} value={datatype} title={xsdDatatypeDescription(datatype)}>
              {xsdDatatypeLabel(datatype)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
