import { asExample } from './builder';

/**
 * An insurance firm. `Party` sitting above both `Person` and `Organisation` is the standard
 * move that lets a policy be held by either without duplicating every relation, and
 * `insures` is drawn from each policy kind to the asset it covers — the clearest possible
 * case of one property meaning something different on each class.
 */
export const insurance = asExample({
  key: 'insurance',
  title: 'Insurance firm',
  summary:
    'Policies, the assets they cover and the claims made against them. Shows a Party abstraction over people and companies, and one relation whose range differs per policy type.',
  iri: 'https://example.org/insurance/',
  prefix: 'ins',
  metadata: [
    ['dcterms:title', 'General Insurance', 'en'],
    [
      'dcterms:description',
      'A schema covering policies, coverages, insured assets, claims and settlement.',
      'en',
    ],
    ['dcterms:creator', 'OntoSchema examples'],
    ['owl:versionInfo', '1.0.0'],
  ],

  classes: [
    {
      name: 'Party',
      at: [40, 40],
      definition: 'Any person or company the firm deals with.',
      attributes: [
        ['partyReference', 'string'],
        ['contactEmail', 'string'],
        ['contactPhone', 'string'],
        ['addressLine', 'string'],
        ['postcode', 'string'],
      ],
    },
    {
      name: 'Person',
      parent: 'Party',
      at: [40, 380],
      definition: 'An individual.',
      attributes: [
        ['fullName', 'string'],
        ['dateOfBirth', 'date'],
        ['occupation', 'string'],
      ],
    },
    {
      name: 'Organisation',
      parent: 'Party',
      at: [320, 380],
      definition: 'A company or other legal entity.',
      attributes: [
        ['legalName', 'string'],
        ['registrationNumber', 'string'],
        ['industry', 'string'],
      ],
    },
    {
      name: 'Agent',
      parent: 'Person',
      at: [40, 700],
      definition: 'A broker or adviser who sells policies.',
      attributes: [
        ['agentCode', 'string'],
        ['commissionRate', 'decimal'],
        ['isAuthorised', 'boolean'],
      ],
    },
    {
      name: 'Policy',
      at: [680, 40],
      definition: 'A contract of insurance between the firm and a party.',
      attributes: [
        ['policyNumber', 'string'],
        ['startsOn', 'date'],
        ['endsOn', 'date'],
        ['annualPremium', 'decimal'],
        ['excess', 'decimal'],
        ['status', 'string'],
        ['isAutoRenewing', 'boolean'],
      ],
    },
    {
      name: 'MotorPolicy',
      parent: 'Policy',
      at: [680, 380],
      definition: 'Insurance for a vehicle.',
      attributes: [
        ['noClaimsYears', 'integer'],
        ['annualMileageLimit', 'integer'],
      ],
    },
    {
      name: 'HomePolicy',
      parent: 'Policy',
      at: [960, 380],
      definition: 'Insurance for a dwelling and its contents.',
      attributes: [
        ['contentsLimit', 'decimal'],
        ['coversAccidentalDamage', 'boolean'],
      ],
    },
    {
      name: 'LifePolicy',
      parent: 'Policy',
      at: [1240, 380],
      definition: 'Insurance paying out on death or terminal illness.',
      attributes: [
        ['sumAssured', 'decimal'],
        ['termYears', 'integer'],
      ],
    },
    {
      name: 'Coverage',
      at: [680, 700],
      definition: 'One risk a policy covers, and to what limit.',
      attributes: [
        ['coverageType', 'string'],
        ['limitAmount', 'decimal'],
        ['deductible', 'decimal'],
      ],
    },
    {
      name: 'InsuredAsset',
      at: [1560, 40],
      definition: 'Something of value protected by a policy.',
      attributes: [
        ['assetReference', 'string'],
        ['estimatedValue', 'decimal'],
        ['valuedOn', 'date'],
      ],
    },
    {
      name: 'Vehicle',
      parent: 'InsuredAsset',
      at: [1560, 380],
      definition: 'An insured vehicle.',
      attributes: [
        ['vin', 'string'],
        ['registrationPlate', 'string'],
        ['make', 'string'],
        ['model', 'string'],
      ],
    },
    {
      name: 'Dwelling',
      parent: 'InsuredAsset',
      at: [1840, 380],
      definition: 'An insured home.',
      attributes: [
        ['buildYear', 'integer'],
        ['bedroomCount', 'integer'],
        ['isListedBuilding', 'boolean'],
      ],
    },
    {
      name: 'Claim',
      at: [1240, 700],
      definition: 'A request for payment under a policy.',
      attributes: [
        ['claimNumber', 'string'],
        ['reportedOn', 'date'],
        ['incidentOn', 'date'],
        ['amountClaimed', 'decimal'],
        ['claimStatus', 'string'],
        ['description', 'string'],
      ],
    },
    {
      name: 'ClaimAssessment',
      at: [1560, 700],
      definition: 'The firm’s judgement on a claim.',
      attributes: [
        ['assessedOn', 'date'],
        ['amountApproved', 'decimal'],
        ['isFraudSuspected', 'boolean'],
        ['assessorNotes', 'string'],
      ],
    },
    {
      name: 'Payment',
      at: [1840, 700],
      definition: 'Money moving in either direction.',
      attributes: [
        ['paidOn', 'date'],
        ['amount', 'decimal'],
        ['currency', 'string'],
        ['method', 'string'],
      ],
    },
  ],

  relations: [
    { name: 'heldBy', from: 'Policy', to: 'Party', definition: 'The party the policy belongs to.' },
    { name: 'soldBy', from: 'Policy', to: 'Agent' },
    { name: 'providesCoverage', from: 'Policy', to: 'Coverage' },
    { name: 'coversAsset', from: 'Coverage', to: 'InsuredAsset' },
    // One property, a different range on each policy kind. Reused, so RDFS states no
    // range at all — a union would wrongly allow a motor policy to insure a house.
    {
      name: 'insures',
      from: 'MotorPolicy',
      to: 'Vehicle',
      definition: 'The asset this policy protects.',
    },
    { name: 'insures', from: 'HomePolicy', to: 'Dwelling' },
    { name: 'beneficiary', from: 'LifePolicy', to: 'Person' },
    { name: 'madeAgainst', from: 'Claim', to: 'Policy' },
    { name: 'claimedBy', from: 'Claim', to: 'Party' },
    { name: 'assesses', from: 'ClaimAssessment', to: 'Claim' },
    { name: 'assessedBy', from: 'ClaimAssessment', to: 'Person' },
    { name: 'settles', from: 'Payment', to: 'Claim' },
    { name: 'paidTo', from: 'Payment', to: 'Party' },
    { name: 'ownedBy', from: 'InsuredAsset', to: 'Party' },
  ],

  spareProperties: [
    ['replacesPolicy', 'A policy this one supersedes on renewal. Draw it to put it on the canvas.'],
  ],
});
