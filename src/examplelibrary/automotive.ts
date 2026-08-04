import { asExample } from './builder';

/**
 * A vehicle dealership: what is sold, who sells it, who buys it, and what happens to it
 * afterwards. The taxonomy is shallow but branches three ways, and `offeredBy` is drawn
 * from all three vehicle kinds so the effect of reusing a property is visible immediately.
 */
export const automotive = asExample({
  key: 'automotive',
  title: 'Vehicle dealership',
  summary:
    'Vehicles, the firms that build and sell them, and the sales, servicing and warranties that follow. Shows a branching taxonomy and a relation reused across three classes.',
  iri: 'https://example.org/automotive/',
  prefix: 'auto',
  metadata: [
    ['dcterms:title', 'Automotive Sales and Service', 'en'],
    [
      'dcterms:description',
      'A schema covering vehicles, the organisations that manufacture, sell and service them, and the transactions between them.',
      'en',
    ],
    ['dcterms:creator', 'OntoSchema examples'],
    ['dcterms:license', 'https://creativecommons.org/licenses/by/4.0/'],
    ['owl:versionInfo', '1.0.0'],
  ],

  classes: [
    {
      name: 'Vehicle',
      at: [40, 40],
      definition: 'A powered road vehicle offered for sale or service.',
      labels: [
        ['Vehicle', 'en'],
        ['Voertuig', 'nl'],
        ['Fahrzeug', 'de'],
      ],
      attributes: [
        ['vin', 'string'],
        ['make', 'string'],
        ['model', 'string'],
        ['modelYear', 'integer'],
        ['colour', 'string'],
        ['mileage', 'integer'],
        ['listPrice', 'decimal'],
        ['firstRegistered', 'date'],
      ],
    },
    {
      name: 'Car',
      parent: 'Vehicle',
      at: [40, 340],
      definition: 'A passenger car.',
      labels: [
        ['Car', 'en'],
        ['Auto', 'nl'],
      ],
      attributes: [
        ['doorCount', 'integer'],
        ['seatCount', 'integer'],
        ['bodyStyle', 'string'],
      ],
    },
    {
      name: 'Truck',
      parent: 'Vehicle',
      at: [320, 340],
      definition: 'A goods vehicle.',
      attributes: [
        ['payloadKg', 'integer'],
        ['axleCount', 'integer'],
      ],
    },
    {
      name: 'Motorcycle',
      parent: 'Vehicle',
      at: [600, 340],
      definition: 'A two-wheeled motor vehicle.',
      attributes: [['hasSidecar', 'boolean']],
    },
    {
      name: 'Engine',
      at: [880, 40],
      definition: 'The power unit fitted to a vehicle.',
      attributes: [
        ['engineCode', 'string'],
        ['displacementLitres', 'decimal'],
        ['horsepower', 'integer'],
        ['fuelType', 'string'],
        ['isElectric', 'boolean'],
      ],
    },
    {
      name: 'Organisation',
      at: [1160, 40],
      definition: 'A company taking part in the trade.',
      attributes: [
        ['legalName', 'string'],
        ['registrationNumber', 'string'],
        ['website', 'anyURI'],
        ['foundedOn', 'date'],
      ],
    },
    {
      name: 'Manufacturer',
      parent: 'Organisation',
      at: [1160, 340],
      definition: 'An organisation that builds vehicles.',
      attributes: [['countryOfOrigin', 'string']],
    },
    {
      name: 'Dealership',
      parent: 'Organisation',
      at: [1440, 340],
      definition: 'An organisation that sells vehicles to the public.',
      labels: [
        ['Dealership', 'en'],
        ['Autodealer', 'nl'],
      ],
      attributes: [
        ['tradingName', 'string'],
        ['city', 'string'],
        ['isAuthorised', 'boolean'],
      ],
    },
    {
      name: 'ServiceCentre',
      parent: 'Organisation',
      at: [1720, 340],
      definition: 'A workshop that services and repairs vehicles.',
      attributes: [
        ['bayCount', 'integer'],
        ['openedOn', 'date'],
      ],
    },
    {
      name: 'Person',
      at: [40, 640],
      definition: 'A human taking part in the trade.',
      attributes: [
        ['fullName', 'string'],
        ['email', 'string'],
        ['phone', 'string'],
        ['dateOfBirth', 'date'],
      ],
    },
    {
      name: 'Customer',
      parent: 'Person',
      at: [40, 940],
      definition: 'Someone who buys or owns a vehicle.',
      attributes: [
        ['customerSince', 'date'],
        ['loyaltyPoints', 'integer'],
      ],
    },
    {
      name: 'Employee',
      parent: 'Person',
      at: [320, 940],
      definition: 'Someone employed by an organisation in the trade.',
      attributes: [
        ['staffNumber', 'string'],
        ['jobTitle', 'string'],
        ['hiredOn', 'date'],
      ],
    },
    {
      name: 'SalesTransaction',
      at: [640, 640],
      definition: 'The sale of one vehicle to one customer.',
      attributes: [
        ['invoiceNumber', 'string'],
        ['soldOn', 'date'],
        ['salePrice', 'decimal'],
        ['discount', 'decimal'],
        ['paymentMethod', 'string'],
      ],
    },
    {
      name: 'ServiceRecord',
      at: [1000, 640],
      definition: 'One visit of a vehicle to a service centre.',
      attributes: [
        ['servicedOn', 'date'],
        ['odometerReading', 'integer'],
        ['workDescription', 'string'],
        ['labourHours', 'decimal'],
        ['totalCost', 'decimal'],
      ],
    },
    {
      name: 'Warranty',
      at: [1360, 640],
      definition: 'A guarantee covering a vehicle for a period.',
      attributes: [
        ['policyNumber', 'string'],
        ['startsOn', 'date'],
        ['endsOn', 'date'],
        ['coverageKm', 'integer'],
        ['isTransferable', 'boolean'],
      ],
    },
  ],

  relations: [
    {
      name: 'manufacturedBy',
      from: 'Vehicle',
      to: 'Manufacturer',
      definition: 'The organisation that built the vehicle.',
    },
    { name: 'hasEngine', from: 'Vehicle', to: 'Engine' },
    // Drawn three times, so RDFS can no longer state a domain — but each class keeps its
    // own SHACL shape. Open the Export tab to see the difference.
    {
      name: 'offeredBy',
      from: 'Car',
      to: 'Dealership',
      definition: 'A dealership offering this kind of vehicle for sale.',
    },
    { name: 'offeredBy', from: 'Truck', to: 'Dealership' },
    { name: 'offeredBy', from: 'Motorcycle', to: 'Dealership' },
    { name: 'involvesVehicle', from: 'SalesTransaction', to: 'Vehicle' },
    { name: 'soldTo', from: 'SalesTransaction', to: 'Customer' },
    { name: 'soldBy', from: 'SalesTransaction', to: 'Employee' },
    { name: 'servicedAt', from: 'Vehicle', to: 'ServiceCentre' },
    { name: 'hasServiceRecord', from: 'Vehicle', to: 'ServiceRecord' },
    { name: 'performedBy', from: 'ServiceRecord', to: 'Employee' },
    { name: 'coveredBy', from: 'Vehicle', to: 'Warranty' },
    { name: 'issuedBy', from: 'Warranty', to: 'Manufacturer' },
    { name: 'employedBy', from: 'Employee', to: 'Organisation' },
    { name: 'ownedBy', from: 'Vehicle', to: 'Customer' },
  ],

  spareProperties: [
    ['tradedInAgainst', 'A vehicle given in part-exchange. Draw it to put it on the canvas.'],
  ],
});
