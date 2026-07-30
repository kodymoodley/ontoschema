import {
  addAnnotation,
  addClass,
  addDatatypeProperty,
  addObjectProperty,
  addSubClassOf,
  createEmptyOntology,
} from '../../src/ontologymodel';
import type { Ontology } from '../../src/ontologymodel';
import type { XsdDatatype } from '../../src/annotationvocabulary';

/**
 * The Car/Dealership scenario from the product brief, built through the real mutation API
 * so the fixture can never drift from a state the UI could actually produce.
 *
 * Vehicle
 *   +- Car (make, model, year, engine, price)  --offeredBy-->  Dealership
 *   +- Truck                                                   (Organization)
 * plus a generic `hasPart` with no domain or range.
 */
export interface AutoOntology {
  ontology: Ontology;
  ids: Record<
    | 'vehicle'
    | 'car'
    | 'truck'
    | 'organization'
    | 'dealership'
    | 'offeredBy'
    | 'hasPart'
    | 'make'
    | 'model'
    | 'year'
    | 'engine'
    | 'price',
    string
  >;
}

export function buildAutoOntology(): AutoOntology {
  let ontology = createEmptyOntology('https://example.org/auto/', 'auto');

  const vehicle = addClass(ontology, { localName: 'Vehicle', position: { x: 0, y: 0 } });
  ontology = vehicle.ontology;
  const car = addClass(ontology, { localName: 'Car', position: { x: 0, y: 160 } });
  ontology = car.ontology;
  const truck = addClass(ontology, { localName: 'Truck', position: { x: 260, y: 160 } });
  ontology = truck.ontology;
  const organization = addClass(ontology, {
    localName: 'Organization',
    position: { x: 560, y: 0 },
  });
  ontology = organization.ontology;
  const dealership = addClass(ontology, { localName: 'Dealership', position: { x: 560, y: 160 } });
  ontology = dealership.ontology;

  ontology = addSubClassOf(ontology, car.id, vehicle.id);
  ontology = addSubClassOf(ontology, truck.id, vehicle.id);
  ontology = addSubClassOf(ontology, dealership.id, organization.id);

  const attributes: [string, XsdDatatype][] = [
    ['make', 'string'],
    ['model', 'string'],
    ['year', 'integer'],
    ['engine', 'string'],
    ['price', 'decimal'],
  ];
  const attributeIds: Record<string, string> = {};
  for (const [localName, range] of attributes) {
    const added = addDatatypeProperty(ontology, { localName, domainClassId: car.id, range });
    ontology = added.ontology;
    attributeIds[localName] = added.id;
  }

  const offeredBy = addObjectProperty(ontology, {
    localName: 'offeredBy',
    kind: 'scoped',
    domainClassId: car.id,
    rangeClassId: dealership.id,
  });
  ontology = offeredBy.ontology;

  const hasPart = addObjectProperty(ontology, {
    localName: 'hasPart',
    kind: 'generic',
    position: { x: 260, y: 360 },
  });
  ontology = hasPart.ontology;

  ontology = addAnnotation(ontology, 'class', car.id, 'skos:prefLabel', 'Car', 'en');
  ontology = addAnnotation(ontology, 'class', car.id, 'skos:prefLabel', 'Auto', 'nl');
  ontology = addAnnotation(
    ontology,
    'class',
    car.id,
    'skos:definition',
    'A road vehicle with four wheels powered by an engine.',
    'en',
  );
  ontology = addAnnotation(ontology, 'class', car.id, 'rdfs:comment', 'Central class.', 'en');
  ontology = addAnnotation(ontology, 'class', dealership.id, 'skos:prefLabel', 'Dealership', 'en');
  ontology = addAnnotation(ontology, 'class', dealership.id, 'skos:altLabel', 'Autodealer', 'nl');
  ontology = addAnnotation(
    ontology,
    'objectProperty',
    offeredBy.id,
    'rdfs:label',
    'offered by',
    'en',
  );
  ontology = addAnnotation(
    ontology,
    'datatypeProperty',
    attributeIds.price ?? '',
    'skos:definition',
    'Asking price in euro.',
    'en',
  );

  ontology = addAnnotation(ontology, 'ontology', '', 'dcterms:title', 'Automotive Schema', 'en');
  ontology = addAnnotation(
    ontology,
    'ontology',
    '',
    'dcterms:description',
    'A small TBox covering vehicles and the organisations that sell them.',
    'en',
  );
  ontology = addAnnotation(ontology, 'ontology', '', 'dcterms:creator', 'OntoSchema');
  ontology = addAnnotation(ontology, 'ontology', '', 'dcterms:created', '2026-07-30');
  ontology = addAnnotation(ontology, 'ontology', '', 'owl:versionInfo', '1.0.0');
  ontology = addAnnotation(
    ontology,
    'ontology',
    '',
    'dcterms:license',
    'https://creativecommons.org/licenses/by/4.0/',
  );

  return {
    ontology,
    ids: {
      vehicle: vehicle.id,
      car: car.id,
      truck: truck.id,
      organization: organization.id,
      dealership: dealership.id,
      offeredBy: offeredBy.id,
      hasPart: hasPart.id,
      make: attributeIds.make ?? '',
      model: attributeIds.model ?? '',
      year: attributeIds.year ?? '',
      engine: attributeIds.engine ?? '',
      price: attributeIds.price ?? '',
    },
  };
}
