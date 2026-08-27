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
      comment:
        'The individual vehicle, identified by its VIN — not the model. Two identical cars on the forecourt are two vehicles.',
      example: 'The blue estate with 42,000 miles on it.',
      labels: [
        ['Vehicle', 'en'],
        ['Voertuig', 'nl'],
        ['Fahrzeug', 'de'],
      ],
      attributes: [
        {
          name: 'vin',
          range: 'string',
          label: 'VIN',
          definition: 'The seventeen-character Vehicle Identification Number.',
          comment: 'The only truly unique identifier here, and the one a registration can outlive.',
          example: 'WVWZZZ1JZXW000001',
        },
        {
          name: 'make',
          range: 'string',
          definition: 'The marque the vehicle is sold under.',
          comment:
            'Held as text as well as through manufacturedBy, because the marque and the company that owns it often differ.',
          example: 'Volkswagen',
        },
        {
          name: 'model',
          range: 'string',
          definition: 'The model name given by the manufacturer.',
          comment:
            'A name, not a class: modelling every model would double the size of this schema.',
          example: 'Golf',
        },
        {
          name: 'modelYear',
          range: 'integer',
          definition: 'The model year the vehicle belongs to.',
          comment:
            'Not the year it was built: manufacturers run model years ahead of the calendar.',
          example: '2019',
        },
        {
          name: 'colour',
          range: 'string',
          definition: 'The colour of the bodywork as sold.',
          comment: "The manufacturer's name for it, which is why this is text and not a code.",
          example: 'Deep Black Pearl',
        },
        {
          name: 'mileage',
          range: 'integer',
          definition: 'Distance travelled, as shown on the odometer.',
          comment:
            'A figure at a moment in time. The reading at each service is kept on ServiceRecord instead.',
          example: '42000',
        },
        {
          name: 'listPrice',
          range: 'decimal',
          definition: 'The asking price before any negotiation.',
          comment:
            'What was asked, not what was paid — the price agreed lives on SalesTransaction.',
          example: '18995.00',
        },
        {
          name: 'firstRegistered',
          range: 'date',
          definition: 'The day the vehicle was first put on the road.',
          comment: 'What a vehicle age is measured from, rather than the model year.',
          example: '2019-03-01',
        },
      ],
    },
    {
      name: 'Car',
      parent: 'Vehicle',
      at: [40, 340],
      definition: 'A vehicle built to carry people rather than goods.',
      comment: 'Carries only what a truck and a motorcycle have no use for.',
      example: 'A five-door hatchback.',
      labels: [
        ['Car', 'en'],
        ['Auto', 'nl'],
      ],
      attributes: [
        {
          name: 'doorCount',
          range: 'integer',
          definition: 'How many doors the car has.',
          comment: 'Counted the way the trade counts them, so a hatchback tailgate is a door.',
          example: '5',
        },
        {
          name: 'seatCount',
          range: 'integer',
          definition: 'How many people the car is built to carry.',
          comment: 'As approved, including the driver.',
          example: '5',
        },
        {
          name: 'bodyStyle',
          range: 'string',
          definition: 'The shape of the body.',
          comment: 'Text rather than a fixed list, because the trade keeps inventing new ones.',
          example: 'Estate',
        },
      ],
    },
    {
      name: 'Truck',
      parent: 'Vehicle',
      at: [320, 340],
      definition: 'A goods vehicle built to carry a load.',
      comment: 'Split from Car by what it is for, which is what its own attributes are about.',
      example: 'A two-axle flatbed.',
      attributes: [
        {
          name: 'payloadKg',
          range: 'integer',
          label: 'Payload (kg)',
          definition: 'The greatest load the truck may legally carry.',
          comment: 'The load, not the total weight of the vehicle with it.',
          example: '1200',
        },
        {
          name: 'axleCount',
          range: 'integer',
          definition: 'How many axles the truck runs on.',
          comment: 'What most road tolls and weight limits are set by.',
          example: '2',
        },
      ],
    },
    {
      name: 'Motorcycle',
      parent: 'Vehicle',
      at: [600, 340],
      definition: 'A two-wheeled motor vehicle.',
      comment: 'The third branch, present to make offeredBy span three classes rather than two.',
      example: 'A 650cc touring bike.',
      attributes: [
        {
          name: 'hasSidecar',
          range: 'boolean',
          definition: 'Whether a sidecar is fitted.',
          comment: 'Changes the licence needed to ride it, which is why it is recorded at all.',
          example: 'false',
        },
      ],
    },
    {
      name: 'Engine',
      at: [880, 40],
      definition: 'The power unit fitted to a vehicle.',
      comment:
        'A class of its own because an engine is replaced, recalled and specified separately from the vehicle around it.',
      example: 'A 2.0-litre diesel.',
      attributes: [
        {
          name: 'engineCode',
          range: 'string',
          definition: "The manufacturer's identifier for this engine design.",
          comment:
            'Identifies the design, not the individual unit, which is what parts are ordered against.',
          example: 'CRBC',
        },
        {
          name: 'displacementLitres',
          range: 'decimal',
          label: 'Displacement (litres)',
          definition: 'Swept volume of the cylinders.',
          comment: 'Decimal because engines are spoken about in tenths of a litre.',
          example: '2.0',
        },
        {
          name: 'horsepower',
          range: 'integer',
          definition: 'Power output at the crankshaft.',
          comment: 'One figure, though which standard it was measured to varies by market.',
          example: '150',
        },
        {
          name: 'fuelType',
          range: 'string',
          definition: 'What the engine runs on.',
          comment:
            'Text, so hybrids can be described without inventing a class for each combination.',
          example: 'Diesel',
        },
        {
          name: 'isElectric',
          range: 'boolean',
          definition: 'Whether the unit is purely electric.',
          comment: 'A flag rather than a fuel type, because it changes what the other fields mean.',
          example: 'false',
        },
      ],
    },
    {
      name: 'Organisation',
      at: [1160, 40],
      definition: 'A company taking part in the trade.',
      comment:
        'Above the three roles below, so the facts every company has are stated once. A firm can play more than one role.',
      example: 'A registered company.',
      attributes: [
        {
          name: 'legalName',
          range: 'string',
          definition: 'The name the company is registered under.',
          comment: 'Kept apart from a trading name, which is what appears on the forecourt.',
          example: 'Northgate Motors Limited',
        },
        {
          name: 'registrationNumber',
          range: 'string',
          definition: 'The identifier held by the company register.',
          comment: 'A string because it carries leading zeros and letters in most jurisdictions.',
          example: '04512377',
        },
        {
          name: 'website',
          range: 'anyURI',
          definition: 'The official site for the company.',
          comment: 'One address, the one the company controls.',
          example: 'https://example.org/northgate',
        },
        {
          name: 'foundedOn',
          range: 'date',
          definition: 'The day the company was incorporated.',
          comment: 'Incorporation, which can be well after trading began.',
          example: '2002-06-11',
        },
      ],
    },
    {
      name: 'Manufacturer',
      parent: 'Organisation',
      at: [1160, 340],
      definition: 'An organisation that builds vehicles.',
      comment: 'A role, not a separate kind of company: a manufacturer may also run dealerships.',
      example: 'Volkswagen AG.',
      attributes: [
        {
          name: 'countryOfOrigin',
          range: 'string',
          definition: 'Where the manufacturer is based.',
          comment: 'Where the company is from, not where any given vehicle was assembled.',
          example: 'Germany',
        },
      ],
    },
    {
      name: 'Dealership',
      parent: 'Organisation',
      at: [1440, 340],
      definition: 'An organisation that sells vehicles to the public.',
      comment: 'One site. A chain of showrooms is several dealerships under one company.',
      example: 'Northgate Motors, Leeds.',
      labels: [
        ['Dealership', 'en'],
        ['Autodealer', 'nl'],
      ],
      attributes: [
        {
          name: 'tradingName',
          range: 'string',
          definition: 'The name the dealership trades under.',
          comment: 'What is on the sign, which is rarely the legal name.',
          example: 'Northgate Motors',
        },
        {
          name: 'city',
          range: 'string',
          definition: 'Where the showroom is.',
          comment: 'A city rather than an address, which is what buyers search by.',
          example: 'Leeds',
        },
        {
          name: 'isAuthorised',
          range: 'boolean',
          definition: 'Whether a manufacturer has franchised this dealership.',
          comment: 'What separates a franchised dealer from an independent one.',
          example: 'true',
        },
      ],
    },
    {
      name: 'ServiceCentre',
      parent: 'Organisation',
      at: [1720, 340],
      definition: 'A workshop that services and repairs vehicles.',
      comment: 'Separate from a dealership because plenty of workshops sell nothing at all.',
      example: 'An independent garage.',
      attributes: [
        {
          name: 'bayCount',
          range: 'integer',
          definition: 'How many vehicles can be worked on at once.',
          comment: 'The usual measure of a workshop, and what its capacity is booked against.',
          example: '6',
        },
        {
          name: 'openedOn',
          range: 'date',
          definition: 'The day the workshop opened.',
          comment: 'The site opening, which may differ from the company being founded.',
          example: '2011-09-05',
        },
      ],
    },
    {
      name: 'Person',
      at: [40, 640],
      definition: 'A human taking part in the trade.',
      comment:
        'Above customer and employee, because the same person is often both — the salesperson who buys a car.',
      example: 'Anyone in the address book.',
      attributes: [
        {
          name: 'fullName',
          range: 'string',
          definition: 'The name the person goes by.',
          comment:
            'One field, deliberately: splitting names into given and family breaks outside a narrow set of conventions.',
          example: 'Aisha Rahman',
        },
        {
          name: 'email',
          range: 'string',
          definition: 'An address to reach the person at.',
          comment: 'A string rather than a URI, because that is what people paste into a form.',
          example: 'aisha@example.org',
        },
        {
          name: 'phone',
          range: 'string',
          definition: 'A number to reach the person on.',
          comment: 'A string, because a phone number has a leading zero and is never arithmetic.',
          example: '+44 113 496 0000',
        },
        {
          name: 'dateOfBirth',
          range: 'date',
          definition: 'The day the person was born.',
          comment: 'Held because finance and insurance need an age, not for its own sake.',
          example: '1986-11-02',
        },
      ],
    },
    {
      name: 'Customer',
      parent: 'Person',
      at: [40, 940],
      definition: 'Someone who buys or owns a vehicle.',
      comment: 'A role. Someone becomes a customer through a transaction, not by being a person.',
      example: 'The buyer on an invoice.',
      attributes: [
        {
          name: 'customerSince',
          range: 'date',
          definition: 'When this person first bought from the business.',
          comment: 'The first purchase, which is what loyalty is measured from.',
          example: '2015-04-18',
        },
        {
          name: 'loyaltyPoints',
          range: 'integer',
          definition: 'Points accrued on the loyalty scheme.',
          comment: 'A running total, so it says nothing about how it was reached.',
          example: '1450',
        },
      ],
    },
    {
      name: 'Employee',
      parent: 'Person',
      at: [320, 940],
      definition: 'Someone employed by an organisation in the trade.',
      comment: 'The other role a person can take, and the reason Person exists above both.',
      example: 'A salesperson or a technician.',
      attributes: [
        {
          name: 'staffNumber',
          range: 'string',
          definition: 'The identifier the employer uses.',
          comment:
            'Unique within one employer, which is why it is not an identifier for the person.',
          example: 'NG-0142',
        },
        {
          name: 'jobTitle',
          range: 'string',
          definition: 'What the employee does.',
          comment:
            'Text, not a role class: job titles are invented faster than they can be modelled.',
          example: 'Senior Technician',
        },
        {
          name: 'hiredOn',
          range: 'date',
          definition: 'The day the employment began.',
          comment: 'The current employment; a work history is out of scope here.',
          example: '2018-02-19',
        },
      ],
    },
    {
      name: 'SalesTransaction',
      at: [640, 640],
      definition: 'The sale of one vehicle to one customer.',
      comment:
        'The event, which is what makes a person a customer and a vehicle sold. Everything about the sale that the vehicle itself should not carry lives here.',
      example: 'Invoice NG-2024-0088.',
      attributes: [
        {
          name: 'invoiceNumber',
          range: 'string',
          definition: 'The identifier on the paperwork.',
          comment: 'The reference a customer will quote, so it has to survive as written.',
          example: 'NG-2024-0088',
        },
        {
          name: 'soldOn',
          range: 'date',
          definition: 'The day the sale completed.',
          comment: 'Completion, not the day a deposit was taken.',
          example: '2024-05-02',
        },
        {
          name: 'salePrice',
          range: 'decimal',
          definition: 'What the customer actually paid.',
          comment: 'The agreed figure, which is why the vehicle keeps its asking price separately.',
          example: '17250.00',
        },
        {
          name: 'discount',
          range: 'decimal',
          definition: 'How much came off the asking price.',
          comment: 'Recorded rather than derived, because a part-exchange muddies the subtraction.',
          example: '1745.00',
        },
        {
          name: 'paymentMethod',
          range: 'string',
          definition: 'How the sale was paid for.',
          comment: 'Text, so finance arrangements can be described without a class for each.',
          example: 'Hire purchase',
        },
      ],
    },
    {
      name: 'ServiceRecord',
      at: [1000, 640],
      definition: 'One visit of a vehicle to a service centre.',
      comment:
        'One visit, so a vehicle history is the set of them rather than a field on the vehicle.',
      example: 'The 40,000-mile service.',
      attributes: [
        {
          name: 'servicedOn',
          range: 'date',
          definition: 'The day the work was done.',
          comment: 'When the work happened, not when it was booked or invoiced.',
          example: '2023-11-20',
        },
        {
          name: 'odometerReading',
          range: 'integer',
          definition: 'What the odometer showed at the visit.',
          comment:
            'A reading at a point in time, which is what makes a service history evidence rather than a claim.',
          example: '39880',
        },
        {
          name: 'workDescription',
          range: 'string',
          definition: 'An account of the work carried out at this visit.',
          comment: 'Free prose, because this is what the customer reads on the invoice.',
          example: 'Oil and filter change, front brake pads replaced.',
        },
        {
          name: 'labourHours',
          range: 'decimal',
          definition: 'Time booked to the job.',
          comment: 'Decimal because labour is billed in fractions of an hour.',
          example: '2.5',
        },
        {
          name: 'totalCost',
          range: 'decimal',
          definition: 'What the visit cost the customer.',
          comment: 'Parts and labour together; splitting them needs a line-item class.',
          example: '412.60',
        },
      ],
    },
    {
      name: 'Warranty',
      at: [1360, 640],
      definition: 'A guarantee covering a vehicle for a period or a distance.',
      comment:
        'Attached to the vehicle rather than the buyer, which is what makes it transferable.',
      example: 'Three years or 60,000km.',
      attributes: [
        {
          name: 'policyNumber',
          range: 'string',
          definition: 'The identifier of the guarantee.',
          comment: 'What a claim is made against.',
          example: 'WTY-99120',
        },
        {
          name: 'startsOn',
          range: 'date',
          definition: 'The day cover begins.',
          comment: 'Usually first registration, but not always, which is why it is stated.',
          example: '2019-03-01',
        },
        {
          name: 'endsOn',
          range: 'date',
          definition: 'The day cover ends.',
          comment:
            'Whichever comes first, this or the distance limit — nothing here enforces that.',
          example: '2022-03-01',
        },
        {
          name: 'coverageKm',
          range: 'integer',
          label: 'Coverage (km)',
          definition: 'The distance the cover lasts for.',
          comment: 'The other half of the limit, and the reason the end date alone is not enough.',
          example: '60000',
        },
        {
          name: 'isTransferable',
          range: 'boolean',
          definition: 'Whether the cover passes to a new owner.',
          comment: 'What makes a warranty worth something at resale.',
          example: 'true',
        },
      ],
    },
  ],

  relations: [
    {
      name: 'manufacturedBy',
      from: 'Vehicle',
      to: 'Manufacturer',
      definition: 'The organisation that built the vehicle.',
      comment:
        'The builder, which for a badge-engineered car is not always the marque on the boot.',
      example: 'A Golf is manufacturedBy Volkswagen AG.',
    },
    {
      name: 'hasEngine',
      from: 'Vehicle',
      to: 'Engine',
      definition: 'The power unit fitted to this vehicle.',
      comment: 'Fitted now, so replacing an engine changes what this points at.',
      example: 'The blue estate hasEngine the 2.0-litre diesel.',
    },
    // Drawn three times, so RDFS can no longer state a domain — but each class keeps its
    // own SHACL shape. Open the Export tab to see the difference.
    {
      name: 'offeredBy',
      from: 'Car',
      to: 'Dealership',
      definition: 'A dealership offering this kind of vehicle for sale.',
      comment:
        'Drawn from all three vehicle kinds, which is what makes it worth looking at: RDFS can no longer state one rdfs:domain, while each class keeps a SHACL shape of its own. The Export tab shows both.',
      example: 'A Golf is offeredBy Northgate Motors.',
    },
    { name: 'offeredBy', from: 'Truck', to: 'Dealership' },
    { name: 'offeredBy', from: 'Motorcycle', to: 'Dealership' },
    {
      name: 'involvesVehicle',
      from: 'SalesTransaction',
      to: 'Vehicle',
      definition: 'The vehicle that changed hands.',
      comment: 'One vehicle per sale; a part-exchange is two transactions, not one with two.',
      example: 'Invoice NG-2024-0088 involvesVehicle the blue estate.',
    },
    {
      name: 'soldTo',
      from: 'SalesTransaction',
      to: 'Customer',
      definition: 'The customer who bought.',
      comment: 'The buyer on the paperwork, who need not be the person who ends up driving it.',
      example: 'Invoice NG-2024-0088 soldTo Aisha Rahman.',
    },
    {
      name: 'soldBy',
      from: 'SalesTransaction',
      to: 'Employee',
      definition: 'The employee who handled the sale.',
      comment: 'Who gets the commission, which is why it is the employee and not the dealership.',
      example: 'Invoice NG-2024-0088 soldBy staff NG-0142.',
    },
    {
      name: 'servicedAt',
      from: 'Vehicle',
      to: 'ServiceCentre',
      definition: 'A workshop this vehicle is serviced at.',
      comment: 'The standing arrangement; each individual visit is a ServiceRecord.',
      example: 'The blue estate is servicedAt Northgate Workshop.',
    },
    {
      name: 'hasServiceRecord',
      from: 'Vehicle',
      to: 'ServiceRecord',
      definition: 'A visit in this vehicle history.',
      comment: 'Many per vehicle, which together are what a buyer means by service history.',
      example: 'The blue estate hasServiceRecord the 40,000-mile service.',
    },
    {
      name: 'performedBy',
      from: 'ServiceRecord',
      to: 'Employee',
      definition: 'The technician who did the work.',
      comment: 'The person, so work can be traced back through a recall.',
      example: 'The 40,000-mile service was performedBy staff NG-0142.',
    },
    {
      name: 'coveredBy',
      from: 'Vehicle',
      to: 'Warranty',
      definition: 'A guarantee that covers this vehicle.',
      comment: 'More than one is normal: a manufacturer warranty and a paint warranty can overlap.',
      example: 'The blue estate is coveredBy WTY-99120.',
    },
    {
      name: 'issuedBy',
      from: 'Warranty',
      to: 'Manufacturer',
      definition: 'Who stands behind the guarantee.',
      comment: 'The manufacturer here; a dealer-issued warranty would need the range widening.',
      example: 'WTY-99120 was issuedBy Volkswagen AG.',
    },
    {
      name: 'employedBy',
      from: 'Employee',
      to: 'Organisation',
      definition: 'The organisation the employee works for.',
      comment:
        'Points at Organisation, not at Dealership, so workshop staff fit the same relation.',
      example: 'Staff NG-0142 is employedBy Northgate Motors Limited.',
    },
    {
      name: 'ownedBy',
      from: 'Vehicle',
      to: 'Customer',
      definition: 'Who currently owns the vehicle.',
      comment:
        'The current keeper only. A chain of past owners would need a class holding the dates.',
      example: 'The blue estate is ownedBy Aisha Rahman.',
    },
  ],

  spareProperties: [
    {
      name: 'tradedInAgainst',
      definition: 'A vehicle given in part-exchange against another purchase.',
      comment:
        'Declared but never drawn, so it sits unused in the property list. Draw it between two classes to put it on the canvas.',
      example: 'The old hatchback was tradedInAgainst the blue estate.',
    },
  ],
});
