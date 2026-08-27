import { SUGGESTED_LANGUAGE_TAGS, languageNames } from '../annotationvocabulary';

/**
 * Every language that can be chosen, with the widely spoken ones first.
 *
 * A list rather than a text field because the tag has to be a real language: typing into a
 * field the model validates is unworkable, since half of `zh` is not a language and the
 * character would vanish as it was typed. Choosing removes the problem instead of policing it.
 *
 * **The chosen one shows its code alone; the rest carry their names.** A closed select displays
 * the selected option and nothing else, so that is the only row costing width in the panel —
 * `en` rather than `en — English` gives the box beside it about fifty pixels back, on every
 * documentation field. The open list is an overlay and costs the panel nothing, so it keeps the
 * names: picking `nl` out of a hundred and eighty bare codes means already knowing that Dutch is
 * `nl`, which is exactly what a list is meant to save you from.
 */
export function LanguageOptions({ selected = '' }: { selected?: string }) {
  const names = languageNames();
  const common = SUGGESTED_LANGUAGE_TAGS.filter((code) => names.has(code));
  const rest = [...names.keys()]
    .filter((code) => !common.includes(code as (typeof SUGGESTED_LANGUAGE_TAGS)[number]))
    .sort((left, right) => (names.get(left) ?? '').localeCompare(names.get(right) ?? ''));

  const option = (code: string) => (
    <option key={code} value={code}>
      {code === selected ? code : `${code} — ${names.get(code)}`}
    </option>
  );

  return (
    <>
      {/* Short when it is what the closed box will show, and spelled out in the list. */}
      <option value="">{selected === '' ? 'none' : 'no language'}</option>
      <optgroup label="Widely spoken">{common.map(option)}</optgroup>
      <optgroup label="All languages">{rest.map(option)}</optgroup>
    </>
  );
}
