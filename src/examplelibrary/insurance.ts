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
      comment:
        'The standard move in this domain: a policy can be held by a person or a company, and putting Party above both means every relation is drawn once instead of twice.',
      example: 'A policyholder, a claimant or a payee.',
      attributes: [
        {
          name: 'partyReference',
          range: 'string',
          definition: 'The identifier the firm uses for this party.',
          comment: 'Issued by the firm, so it works whether the party is a person or a company.',
          example: 'P-0099412',
        },
        {
          name: 'contactEmail',
          range: 'string',
          definition: 'Where to reach the party by email.',
          comment: 'One address, the one correspondence goes to.',
          example: 'j.okafor@example.org',
        },
        {
          name: 'contactPhone',
          range: 'string',
          definition: 'Where to reach the party by telephone.',
          comment:
            'A string, because a phone number keeps its leading zero and is never arithmetic.',
          example: '+44 20 7946 0000',
        },
        {
          name: 'addressLine',
          range: 'string',
          definition: 'The street part of the postal address.',
          comment:
            'One line, which is the simplification: addresses that need several would break this.',
          example: '14 Mill Lane',
        },
        {
          name: 'postcode',
          range: 'string',
          definition: 'The postal code for the address.',
          comment: 'Held apart from the street, because underwriting prices risk by postcode.',
          example: 'LS1 4AB',
        },
      ],
    },
    {
      name: 'Person',
      parent: 'Party',
      at: [40, 380],
      definition: 'An individual the firm deals with.',
      comment: 'Carries what only a human has, which is what keeps Party free of it.',
      example: 'A named policyholder.',
      attributes: [
        {
          name: 'fullName',
          range: 'string',
          definition: 'The name the person is known by.',
          comment: 'One field, so it does not assume a given-and-family convention.',
          example: 'Joy Okafor',
        },
        {
          name: 'dateOfBirth',
          range: 'date',
          definition: 'The day the person was born.',
          comment: 'Central here rather than incidental: age is priced into almost every premium.',
          example: '1979-04-22',
        },
        {
          name: 'occupation',
          range: 'string',
          definition: 'What the person does for a living.',
          comment: 'Text, though underwriting really wants a classified list of occupations.',
          example: 'Structural engineer',
        },
      ],
    },
    {
      name: 'Organisation',
      parent: 'Party',
      at: [320, 380],
      definition: 'A company or other legal entity.',
      comment: 'The other kind of party, and the reason Party exists above both.',
      example: 'A limited company insuring its premises.',
      attributes: [
        {
          name: 'legalName',
          range: 'string',
          definition: 'The name the entity is registered under.',
          comment: 'The registered name, which is what a contract has to be in.',
          example: 'Mill Lane Joinery Limited',
        },
        {
          name: 'registrationNumber',
          range: 'string',
          definition: 'The identifier held by the company register.',
          comment: 'A string: leading zeros and letters are both normal.',
          example: '07741122',
        },
        {
          name: 'industry',
          range: 'string',
          definition: 'What line of business the entity is in.',
          comment: 'What commercial risk is priced from, and the reason it is recorded at all.',
          example: 'Carpentry and joinery',
        },
      ],
    },
    {
      name: 'Agent',
      parent: 'Person',
      at: [40, 700],
      definition: 'A broker or adviser who sells policies.',
      comment:
        'Under Person, so an agent is also a party and can hold a policy of their own without anything extra.',
      example: 'An appointed representative.',
      attributes: [
        {
          name: 'agentCode',
          range: 'string',
          definition: 'The identifier the firm uses for this agent.',
          comment: 'What commission is tracked against.',
          example: 'AG-2210',
        },
        {
          name: 'commissionRate',
          range: 'decimal',
          definition: 'The share of premium the agent earns.',
          comment: 'A proportion, not a percentage figure, so no multiplying by a hundred.',
          example: '0.075',
        },
        {
          name: 'isAuthorised',
          range: 'boolean',
          definition: 'Whether the agent is currently permitted to sell.',
          comment: 'A regulatory status that can be withdrawn without the record going away.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Policy',
      at: [680, 40],
      definition: 'A contract of insurance between the firm and a party.',
      comment:
        'Holds what every policy has. What differs by kind is on the three subclasses, and what a policy actually covers is on Coverage.',
      example: 'Policy MP-4471, running for a year.',
      attributes: [
        {
          name: 'policyNumber',
          range: 'string',
          definition: 'The identifier of the contract.',
          comment: 'What the customer quotes, so it has to survive exactly as issued.',
          example: 'MP-4471',
        },
        {
          name: 'startsOn',
          range: 'date',
          definition: 'The day cover begins.',
          comment: 'Inception, which may be later than the day the policy was sold.',
          example: '2024-06-01',
        },
        {
          name: 'endsOn',
          range: 'date',
          definition: 'The day cover ends.',
          comment: 'The end of this term; renewal makes a new policy rather than moving this.',
          example: '2025-05-31',
        },
        {
          name: 'annualPremium',
          range: 'decimal',
          definition: 'What the policyholder pays for a year of cover.',
          comment: 'Decimal, so money is never rounded by the type it is stored in.',
          example: '612.40',
        },
        {
          name: 'excess',
          range: 'decimal',
          definition: 'What the policyholder pays towards any claim.',
          comment:
            'The policy-wide figure; a coverage can set its own deductible, which overrides it.',
          example: '250.00',
        },
        {
          name: 'status',
          range: 'string',
          definition: 'Where the policy stands.',
          comment: 'Text rather than a class, which a real system would regret and then fix.',
          example: 'Active',
        },
        {
          name: 'isAutoRenewing',
          range: 'boolean',
          definition: 'Whether cover continues automatically at the end of the term.',
          comment: 'Changes what the end date means, which is why it sits next to it.',
          example: 'true',
        },
      ],
    },
    {
      name: 'MotorPolicy',
      parent: 'Policy',
      at: [680, 380],
      definition: 'Insurance for a vehicle.',
      comment: 'One of the three kinds whose insures relation points somewhere different.',
      example: 'Cover on a van.',
      attributes: [
        {
          name: 'noClaimsYears',
          range: 'integer',
          definition: 'Consecutive years the holder has claimed nothing.',
          comment:
            'The single largest discount in motor insurance, which is why it is on the policy.',
          example: '7',
        },
        {
          name: 'annualMileageLimit',
          range: 'integer',
          definition: 'The distance the policy assumes will be driven.',
          comment: 'A condition of cover, not a measurement: exceeding it can void a claim.',
          example: '12000',
        },
      ],
    },
    {
      name: 'HomePolicy',
      parent: 'Policy',
      at: [960, 380],
      definition: 'Insurance for a dwelling and its contents.',
      comment: 'The second kind, and the one whose insures points at a Dwelling.',
      example: 'Buildings and contents cover on a terraced house.',
      attributes: [
        {
          name: 'contentsLimit',
          range: 'decimal',
          definition: 'The most the policy will pay for contents.',
          comment: 'Separate from the building, which is usually insured for its rebuild cost.',
          example: '50000.00',
        },
        {
          name: 'coversAccidentalDamage',
          range: 'boolean',
          definition: 'Whether damage caused by accident is included.',
          comment: 'Almost always an extra, which is why it is a flag rather than assumed.',
          example: 'false',
        },
      ],
    },
    {
      name: 'LifePolicy',
      parent: 'Policy',
      at: [1240, 380],
      definition: 'Insurance paying out on death or terminal illness.',
      comment:
        'The third kind, and the one that insures no asset at all — which is why insures is not drawn from it.',
      example: 'Twenty-year term cover.',
      attributes: [
        {
          name: 'sumAssured',
          range: 'decimal',
          definition: 'The amount paid out when the policy pays.',
          comment: 'Fixed at inception, unlike a claim on an asset, which is assessed.',
          example: '250000.00',
        },
        {
          name: 'termYears',
          range: 'integer',
          definition: 'How many years the cover runs for.',
          comment: 'Held as a length as well as dates, because that is how the product is sold.',
          example: '20',
        },
      ],
    },
    {
      name: 'Coverage',
      at: [680, 700],
      definition: 'One risk a policy covers, and to what limit.',
      comment:
        'A class rather than fields on the policy, because a policy covers several risks and each has its own limit.',
      example: 'Theft cover up to £10,000.',
      attributes: [
        {
          name: 'coverageType',
          range: 'string',
          definition: 'What risk this covers.',
          comment: 'Text, though a real book of business would want a controlled list.',
          example: 'Theft',
        },
        {
          name: 'limitAmount',
          range: 'decimal',
          definition: 'The most this cover will pay.',
          comment: 'Per risk, so it can be lower than the policy as a whole.',
          example: '10000.00',
        },
        {
          name: 'deductible',
          range: 'decimal',
          definition: 'What the holder pays towards a claim on this cover.',
          comment: 'Overrides the policy excess where the two disagree.',
          example: '100.00',
        },
      ],
    },
    {
      name: 'InsuredAsset',
      at: [1560, 40],
      definition: 'Something of value protected by a policy.',
      comment: 'Above vehicle and dwelling for the same reason Party is above person and company.',
      example: 'Anything with a value on the schedule.',
      attributes: [
        {
          name: 'assetReference',
          range: 'string',
          definition: 'The identifier the firm uses for this asset.',
          comment: "The firm's own reference, which works before any registration is known.",
          example: 'A-77120',
        },
        {
          name: 'estimatedValue',
          range: 'decimal',
          definition: 'What the asset is thought to be worth.',
          comment: 'An estimate, and the reason the date it was made is kept beside it.',
          example: '18500.00',
        },
        {
          name: 'valuedOn',
          range: 'date',
          definition: 'When the valuation was made.',
          comment: 'What makes the value interpretable; an old valuation is a known risk.',
          example: '2024-05-14',
        },
      ],
    },
    {
      name: 'Vehicle',
      parent: 'InsuredAsset',
      at: [1560, 380],
      definition: 'A road vehicle covered by a motor policy.',
      comment: 'What a motor policy points at, and one half of why insures has no single range.',
      example: 'A panel van.',
      attributes: [
        {
          name: 'vin',
          range: 'string',
          label: 'VIN',
          definition: 'The seventeen-character Vehicle Identification Number.',
          comment: 'The identifier that outlives a change of plate.',
          example: 'WVWZZZ1JZXW000001',
        },
        {
          name: 'registrationPlate',
          range: 'string',
          definition: 'The number plate currently carried.',
          comment: 'Transferable and reassignable, which is why the VIN is kept as well.',
          example: 'LS19 KTP',
        },
        {
          name: 'make',
          range: 'string',
          definition: 'The marque of the vehicle.',
          comment: 'One of the two figures that drive a motor premium, with the model.',
          example: 'Volkswagen',
        },
        {
          name: 'model',
          range: 'string',
          definition: 'The model name of the vehicle.',
          comment: 'A name, not a class: modelling every model is a schema of its own.',
          example: 'Transporter',
        },
      ],
    },
    {
      name: 'Dwelling',
      parent: 'InsuredAsset',
      at: [1840, 380],
      definition: 'A residential property covered by a home policy.',
      comment:
        'What a home policy points at, and the other half of why insures has no single range.',
      example: 'A terraced house.',
      attributes: [
        {
          name: 'buildYear',
          range: 'integer',
          definition: 'The year the property was built.',
          comment: 'A year, because older records rarely offer better than that.',
          example: '1904',
        },
        {
          name: 'bedroomCount',
          range: 'integer',
          definition: 'How many bedrooms the property has.',
          comment: 'The usual proxy for size, and what contents cover is estimated from.',
          example: '3',
        },
        {
          name: 'isListedBuilding',
          range: 'boolean',
          definition: 'Whether the property is legally protected.',
          comment: 'Changes what a repair may cost enormously, which is why it is asked.',
          example: 'false',
        },
      ],
    },
    {
      name: 'Claim',
      at: [1240, 700],
      definition: 'A request for payment under a policy.',
      comment:
        'What was asked for. What the firm decided is on ClaimAssessment, deliberately apart.',
      example: 'A claim for storm damage.',
      attributes: [
        {
          name: 'claimNumber',
          range: 'string',
          definition: 'The identifier of the claim.',
          comment: 'What every letter about the claim will quote.',
          example: 'CL-2024-8812',
        },
        {
          name: 'reportedOn',
          range: 'date',
          definition: 'The day the claim was made.',
          comment: 'Kept apart from the incident date, because the gap between them matters.',
          example: '2024-08-19',
        },
        {
          name: 'incidentOn',
          range: 'date',
          definition: 'The day the thing being claimed for happened.',
          comment: 'What decides whether the policy was in force at the time.',
          example: '2024-08-16',
        },
        {
          name: 'amountClaimed',
          range: 'decimal',
          definition: 'What the claimant is asking for.',
          comment: 'The ask, which the assessment may not agree with.',
          example: '3200.00',
        },
        {
          name: 'claimStatus',
          range: 'string',
          definition: 'Where the claim has got to.',
          comment: 'Text, as with policy status, and with the same reservation.',
          example: 'Under assessment',
        },
        {
          name: 'description',
          range: 'string',
          definition: 'What happened, in the claimant own words.',
          comment: 'Free prose, and often the only account of the incident there is.',
          example: 'A tile came off the roof in high wind and cracked the conservatory.',
        },
      ],
    },
    {
      name: 'ClaimAssessment',
      at: [1560, 700],
      definition: 'The judgement the firm reached on a claim.',
      comment:
        'Separate from the claim so that what was asked and what was decided are never confused, and so an assessor can be recorded.',
      example: 'Approved at £2,950.',
      attributes: [
        {
          name: 'assessedOn',
          range: 'date',
          definition: 'The day the judgement was made.',
          comment: 'What service-level targets are measured against.',
          example: '2024-08-29',
        },
        {
          name: 'amountApproved',
          range: 'decimal',
          definition: 'What the firm agreed to pay.',
          comment: 'Frequently less than the amount claimed, which is the point of holding both.',
          example: '2950.00',
        },
        {
          name: 'isFraudSuspected',
          range: 'boolean',
          definition: 'Whether the claim was referred as suspicious.',
          comment: 'A referral, not a finding, and the distinction is worth keeping.',
          example: 'false',
        },
        {
          name: 'assessorNotes',
          range: 'string',
          definition: 'What the assessor recorded about the decision.',
          comment: 'Internal prose, which is why it is not on the claim itself.',
          example: 'Damage consistent with the reported wind speeds. Settled at trade rates.',
        },
      ],
    },
    {
      name: 'Payment',
      at: [1840, 700],
      definition: 'Money moving in either direction.',
      comment:
        'One class for premium and settlement both, which is why it points at a Party rather than a claimant.',
      example: 'A settlement of £2,950.',
      attributes: [
        {
          name: 'paidOn',
          range: 'date',
          definition: 'The day the money moved.',
          comment: 'When it left, not when it was authorised.',
          example: '2024-09-02',
        },
        {
          name: 'amount',
          range: 'decimal',
          definition: 'How much was paid.',
          comment: 'Always positive; direction is a matter of who it went to.',
          example: '2950.00',
        },
        {
          name: 'currency',
          range: 'string',
          definition: 'What currency the payment was made in.',
          comment:
            'Stated here and nowhere else, which is an inconsistency worth noticing: every other amount in this schema assumes one.',
          example: 'GBP',
        },
        {
          name: 'method',
          range: 'string',
          definition: 'How the money was sent.',
          comment: 'Text, so a new payment rail needs no schema change.',
          example: 'Bank transfer',
        },
      ],
    },
  ],

  relations: [
    {
      name: 'heldBy',
      from: 'Policy',
      to: 'Party',
      definition: 'The party the policy belongs to.',
      comment:
        'Points at Party, not at Person, which is exactly what the abstraction buys: one relation covers a policy held by an individual and one held by a company.',
      example: 'Policy MP-4471 is heldBy Joy Okafor.',
    },
    {
      name: 'soldBy',
      from: 'Policy',
      to: 'Agent',
      definition: 'The agent who sold the policy.',
      comment: 'Who earns the commission, which is why it is the agent and not the firm.',
      example: 'Policy MP-4471 was soldBy agent AG-2210.',
    },
    {
      name: 'providesCoverage',
      from: 'Policy',
      to: 'Coverage',
      definition: 'A risk this policy covers.',
      comment: 'Several per policy, each with its own limit — the reason Coverage is a class.',
      example: 'Policy MP-4471 providesCoverage theft up to £10,000.',
    },
    {
      name: 'coversAsset',
      from: 'Coverage',
      to: 'InsuredAsset',
      definition: 'The asset this cover applies to.',
      comment: 'From the coverage rather than the policy, so one policy can cover several things.',
      example: 'The theft cover coversAsset the panel van.',
    },
    // One property, a different range on each policy kind. Reused, so RDFS states no
    // range at all — a union would wrongly allow a motor policy to insure a house.
    {
      name: 'insures',
      from: 'MotorPolicy',
      to: 'Vehicle',
      definition: 'The asset this policy protects.',
      comment:
        'The clearest case in the library of one property meaning something different per class. Drawn to Vehicle from a motor policy and to Dwelling from a home policy, so RDFS states no range at all — a union would wrongly permit a motor policy to insure a house. The SHACL shapes keep them apart; compare the two in the Export tab.',
      example: 'Policy MP-4471 insures the panel van.',
    },
    { name: 'insures', from: 'HomePolicy', to: 'Dwelling' },
    {
      name: 'beneficiary',
      from: 'LifePolicy',
      to: 'Person',
      definition: 'Who is paid when a life policy pays out.',
      comment: 'A Person rather than a Party, because a life policy pays a named individual.',
      example: 'A life policy has beneficiary Joy Okafor.',
    },
    {
      name: 'madeAgainst',
      from: 'Claim',
      to: 'Policy',
      definition: 'The policy this claim is made under.',
      comment: 'What decides whether cover was in force on the incident date.',
      example: 'Claim CL-2024-8812 was madeAgainst policy MP-4471.',
    },
    {
      name: 'claimedBy',
      from: 'Claim',
      to: 'Party',
      definition: 'Who made the claim.',
      comment: 'Not always the policyholder, which is why it is recorded separately from heldBy.',
      example: 'Claim CL-2024-8812 was claimedBy Joy Okafor.',
    },
    {
      name: 'assesses',
      from: 'ClaimAssessment',
      to: 'Claim',
      definition: 'The claim this judgement is about.',
      comment: 'One assessment per claim here; a reopened claim would need more than one.',
      example: 'The August assessment assesses claim CL-2024-8812.',
    },
    {
      name: 'assessedBy',
      from: 'ClaimAssessment',
      to: 'Person',
      definition: 'Who reached the judgement.',
      comment: 'A Person, so an external loss adjuster fits without being an employee.',
      example: 'The August assessment was assessedBy Joy Okafor.',
    },
    {
      name: 'settles',
      from: 'Payment',
      to: 'Claim',
      definition: 'The claim this payment discharges.',
      comment: 'Absent on a premium payment, which is money moving the other way.',
      example: 'A £2,950 payment settles claim CL-2024-8812.',
    },
    {
      name: 'paidTo',
      from: 'Payment',
      to: 'Party',
      definition: 'Who received the money.',
      comment: 'A Party, so a payment to a repairer and one to a policyholder look the same.',
      example: 'The £2,950 payment was paidTo Joy Okafor.',
    },
    {
      name: 'ownedBy',
      from: 'InsuredAsset',
      to: 'Party',
      definition: 'Who owns the insured asset.',
      comment:
        'Kept apart from who holds the policy, because a company can insure a vehicle its director owns.',
      example: 'The panel van is ownedBy Mill Lane Joinery Limited.',
    },
  ],

  spareProperties: [
    {
      name: 'replacesPolicy',
      definition: 'A policy this one supersedes on renewal.',
      comment:
        'Declared but never drawn, so it sits unused in the property list. Draw it between two classes to put it on the canvas.',
      example: 'Policy MP-4471 replacesPolicy MP-3980.',
    },
  ],
});
