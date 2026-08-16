import {
  addAnnotation,
  addAttributeToClass,
  addClass,
  addRelation,
  addRelationBetween,
  addSubClassOf,
  attachProperty,
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
 * plus `hasPart`, an relation that exists but is not used anywhere.
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
  usageIds: Record<'offeredBy' | 'price', string>;
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
  let priceUsageId = '';
  for (const [localName, range] of attributes) {
    const added = addAttributeToClass(ontology, { classId: car.id, localName, range });
    ontology = added.ontology;
    attributeIds[localName] = added.propertyId;
    if (localName === 'price') priceUsageId = added.usageId;
  }

  const offeredBy = addRelationBetween(ontology, {
    localName: 'offeredBy',
    subjectClassId: car.id,
    objectClassId: dealership.id,
  });
  ontology = offeredBy.ontology;

  // Declared but never used, so it appears in the property list and nowhere on the canvas.
  const hasPart = addRelation(ontology, { localName: 'hasPart' });
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
    'relation',
    offeredBy.propertyId,
    'rdfs:label',
    'offered by',
    'en',
  );
  ontology = addAnnotation(
    ontology,
    'attribute',
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
      offeredBy: offeredBy.propertyId,
      hasPart: hasPart.id,
      make: attributeIds.make ?? '',
      model: attributeIds.model ?? '',
      year: attributeIds.year ?? '',
      engine: attributeIds.engine ?? '',
      price: attributeIds.price ?? '',
    },
    usageIds: { offeredBy: offeredBy.usageId, price: priceUsageId },
  };
}

/**
 * The same scenario with `price` also used on a second class, and `offeredBy` drawn a
 * second time between a different pair — the reuse case that RDFS cannot express.
 */
export function buildReusedOntology(): { ontology: Ontology; ids: AutoOntology['ids'] } {
  const base = buildAutoOntology();
  let ontology = base.ontology;

  const product = addClass(ontology, { localName: 'Product' });
  ontology = product.ontology;
  const garage = addClass(ontology, { localName: 'Garage' });
  ontology = garage.ontology;

  ontology = attachProperty(ontology, {
    propertyId: base.ids.price,
    subjectClassId: product.id,
  }).ontology;

  ontology = attachProperty(ontology, {
    propertyId: base.ids.offeredBy,
    subjectClassId: base.ids.truck,
    objectClassId: garage.id,
  }).ontology;

  return { ontology, ids: base.ids };
}
