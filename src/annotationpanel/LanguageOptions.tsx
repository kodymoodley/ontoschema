import { SUGGESTED_LANGUAGE_TAGS, languageNames } from '../annotationvocabulary';

/**
 * Every language that can be chosen, with the widely spoken ones first.
 *
 * A list rather than a text field because the tag has to be a real language: typing into a
 * field the model validates is unworkable, since half of `zh` is not a language and the
 * character would vanish as it was typed. Choosing removes the problem instead of policing it.
 */
export function LanguageOptions() {
  const names = languageNames();
  const common = SUGGESTED_LANGUAGE_TAGS.filter((code) => names.has(code));
  const rest = [...names.keys()]
    .filter((code) => !common.includes(code as (typeof SUGGESTED_LANGUAGE_TAGS)[number]))
    .sort((left, right) => (names.get(left) ?? '').localeCompare(names.get(right) ?? ''));

  const option = (code: string) => (
    <option key={code} value={code}>
      {code} — {names.get(code)}
    </option>
  );

  return (
    <>
      <option value="">no language</option>
      <optgroup label="Widely spoken">{common.map(option)}</optgroup>
      <optgroup label="All languages">{rest.map(option)}</optgroup>
    </>
  );
}
