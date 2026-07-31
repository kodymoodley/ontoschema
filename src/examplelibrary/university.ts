import { asExample } from './builder';

/**
 * A university. The interesting modelling here is the distinction between a `Course` — the
 * thing in the catalogue — and a `CourseOffering`, one running of it in one term, which is
 * what people actually enrol in and what has a room and a timetable.
 *
 * `prerequisiteOf` points from `Course` back to `Course`, so it also shows a self-relation.
 */
export const university = asExample({
  key: 'university',
  title: 'University',
  summary:
    'Students, staff, courses and the terms they run in. Shows the catalogue-versus-offering distinction, a self-referencing prerequisite relation, and a relation reused for two kinds of membership.',
  iri: 'https://example.org/university/',
  prefix: 'uni',
  metadata: [
    ['dcterms:title', 'University Teaching and Research', 'en'],
    [
      'dcterms:description',
      'A schema covering academic organisation, the teaching catalogue, enrolment and research output.',
      'en',
    ],
    ['dcterms:creator', 'OntoSchema examples'],
    ['owl:versionInfo', '1.0.0'],
  ],

  classes: [
    {
      name: 'Person',
      at: [40, 40],
      definition: 'Anyone the university keeps a record of.',
      attributes: [
        ['fullName', 'string'],
        ['email', 'string'],
        ['dateOfBirth', 'date'],
        ['orcid', 'anyURI'],
      ],
    },
    {
      name: 'Student',
      parent: 'Person',
      at: [40, 340],
      definition: 'A person enrolled on a programme of study.',
      attributes: [
        ['studentNumber', 'string'],
        ['startedOn', 'date'],
        ['isInternational', 'boolean'],
      ],
    },
    {
      name: 'Instructor',
      parent: 'Person',
      at: [320, 340],
      definition: 'A member of academic staff who teaches.',
      attributes: [
        ['staffNumber', 'string'],
        ['academicTitle', 'string'],
        ['appointedOn', 'date'],
      ],
    },
    {
      name: 'Faculty',
      at: [640, 40],
      definition: 'A top-level academic division.',
      attributes: [
        ['facultyName', 'string'],
        ['deanName', 'string'],
      ],
    },
    {
      name: 'Department',
      at: [640, 340],
      definition: 'An academic unit within a faculty.',
      attributes: [
        ['departmentName', 'string'],
        ['departmentCode', 'string'],
        ['budget', 'decimal'],
      ],
    },
    {
      name: 'ResearchGroup',
      at: [640, 640],
      definition: 'A group of staff working on a shared research theme.',
      attributes: [
        ['groupName', 'string'],
        ['researchTheme', 'string'],
        ['foundedOn', 'date'],
      ],
    },
    {
      name: 'Programme',
      at: [960, 40],
      definition: 'A named qualification a student is admitted to.',
      attributes: [
        ['programmeName', 'string'],
        ['award', 'string'],
        ['durationYears', 'integer'],
        ['totalCredits', 'integer'],
      ],
    },
    {
      name: 'Course',
      at: [960, 340],
      definition: 'A unit of teaching as it appears in the catalogue.',
      attributes: [
        ['courseCode', 'string'],
        ['courseTitle', 'string'],
        ['credits', 'integer'],
        ['level', 'integer'],
        ['syllabus', 'string'],
      ],
    },
    {
      name: 'CourseOffering',
      at: [1280, 340],
      definition: 'One running of a course in one term, with its own timetable and staff.',
      attributes: [
        ['term', 'string'],
        ['academicYear', 'string'],
        ['capacity', 'integer'],
        ['startsOn', 'date'],
        ['endsOn', 'date'],
      ],
    },
    {
      name: 'Enrolment',
      at: [1280, 640],
      definition: 'One student taking one offering, and how they did.',
      attributes: [
        ['enrolledOn', 'date'],
        ['mark', 'decimal'],
        ['grade', 'string'],
        ['hasPassed', 'boolean'],
      ],
    },
    {
      name: 'Assessment',
      at: [1600, 340],
      definition: 'A piece of assessed work on an offering.',
      attributes: [
        ['assessmentTitle', 'string'],
        ['assessmentType', 'string'],
        ['weighting', 'decimal'],
        ['dueOn', 'dateTime'],
      ],
    },
    {
      name: 'Building',
      at: [40, 640],
      definition: 'A building on campus.',
      attributes: [
        ['buildingName', 'string'],
        ['address', 'string'],
        ['hasStepFreeAccess', 'boolean'],
      ],
    },
    {
      name: 'Room',
      at: [320, 640],
      definition: 'A teaching room.',
      attributes: [
        ['roomNumber', 'string'],
        ['seats', 'integer'],
        ['floor', 'integer'],
      ],
    },
    {
      name: 'Publication',
      at: [960, 640],
      definition: 'A research output.',
      attributes: [
        ['publicationTitle', 'string'],
        ['doi', 'anyURI'],
        ['publishedOn', 'date'],
        ['venue', 'string'],
        ['citationCount', 'integer'],
      ],
    },
  ],

  relations: [
    // Drawn twice, so one property serves both kinds of membership.
    {
      name: 'partOf',
      from: 'Department',
      to: 'Faculty',
      definition: 'The larger unit this one belongs to.',
    },
    { name: 'partOf', from: 'ResearchGroup', to: 'Department' },
    { name: 'offers', from: 'Department', to: 'Programme' },
    { name: 'includesCourse', from: 'Programme', to: 'Course' },
    { name: 'hasOffering', from: 'Course', to: 'CourseOffering' },
    // A course pointing at a course: perfectly legal, and worth seeing drawn.
    {
      name: 'prerequisiteOf',
      from: 'Course',
      to: 'Course',
      definition: 'A course that must be passed before this one may be taken.',
    },
    { name: 'taughtBy', from: 'CourseOffering', to: 'Instructor' },
    { name: 'heldIn', from: 'CourseOffering', to: 'Room' },
    { name: 'hasAssessment', from: 'CourseOffering', to: 'Assessment' },
    { name: 'forOffering', from: 'Enrolment', to: 'CourseOffering' },
    { name: 'byStudent', from: 'Enrolment', to: 'Student' },
    { name: 'enrolledOnProgramme', from: 'Student', to: 'Programme' },
    { name: 'supervisedBy', from: 'Student', to: 'Instructor' },
    { name: 'memberOf', from: 'Instructor', to: 'ResearchGroup' },
    { name: 'authoredBy', from: 'Publication', to: 'Person' },
    { name: 'locatedIn', from: 'Room', to: 'Building' },
  ],
});
