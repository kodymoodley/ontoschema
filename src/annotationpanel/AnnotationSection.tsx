import { Switch } from '../designsystem';
import { toggleShowTerms, useShowTerms } from '../projectstore';
import type { EntityRef } from '../ontologymodel';
import { AnnotationEditor } from './AnnotationEditor';
import { NamedAnnotationFields } from './NamedAnnotationFields';
import { ENTITY_FIELDS, SCHEMA_FIELDS } from './namedfields';

import styles from './annotationpanel.module.css';

/**
 * Everything that can be said about a schema or an entity, in two layers.
 *
 * The form comes first: a handful of labelled boxes in plain words, which is what people came to
 * fill in. Underneath, unopened, is the whole vocabulary exactly as it was — every term, every
 * value, repeats included. Nothing was taken away; what changed is that you no longer have to
 * meet `dcterms:title` in order to give something a title.
 *
 * The switch between them turns the terms back on beside each label. It sits here, next to the
 * list it belongs with, rather than at the top of the form: it is a setting for the person who
 * wants the RDF, and that is the same person who opens what is below it.
 */
export function AnnotationSection({ target }: { target: EntityRef }) {
  const showTerms = useShowTerms();
  const fields = target.kind === 'ontology' ? SCHEMA_FIELDS : ENTITY_FIELDS;

  return (
    <div className={styles.section}>
      <NamedAnnotationFields target={target} fields={fields} />

      <div className={styles.vocabulary}>
        <Switch checked={showTerms} label="Show RDF terms" onChange={() => toggleShowTerms()}>
          Show RDF terms
        </Switch>

        <details className={styles.other}>
          <summary className={styles.otherSummary}>Other properties</summary>
          <div className={styles.otherBody}>
            <AnnotationEditor target={target} fields={fields} />
          </div>
        </details>
      </div>
    </div>
  );
}
