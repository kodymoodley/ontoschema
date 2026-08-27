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
      comment:
        'Above student and instructor, because the same person is often both — a doctoral student who teaches.',
      example: 'Anyone with a university account.',
      attributes: [
        {
          name: 'fullName',
          range: 'string',
          definition: 'The name the person goes by.',
          comment:
            'One field on purpose: splitting a name into given and family assumes a convention many people do not follow.',
          example: 'Wei Chen',
        },
        {
          name: 'email',
          range: 'string',
          definition: 'The university address for this person.',
          comment: 'The institutional address, which is what accounts are keyed on.',
          example: 'w.chen@example.org',
        },
        {
          name: 'dateOfBirth',
          range: 'date',
          definition: 'The day the person was born.',
          comment:
            'Kept for registry purposes only, and one of the few fields here that is personal.',
          example: '1998-07-30',
        },
        {
          name: 'orcid',
          range: 'anyURI',
          label: 'ORCID',
          definition: 'The persistent researcher identifier for this person.',
          comment:
            'A URI rather than a bare code, because that is the form that resolves and survives a name change.',
          example: 'https://orcid.org/0000-0002-1825-0097',
        },
      ],
    },
    {
      name: 'Student',
      parent: 'Person',
      at: [40, 340],
      definition: 'A person admitted to a programme of study.',
      comment: 'A role rather than a kind of person, which is why it sits under Person.',
      example: 'A second-year undergraduate.',
      attributes: [
        {
          name: 'studentNumber',
          range: 'string',
          definition: 'The registry identifier for this student.',
          comment: 'A string because it carries leading zeros and is never arithmetic.',
          example: '20194471',
        },
        {
          name: 'startedOn',
          range: 'date',
          definition: 'The day the student first registered.',
          comment: 'First registration, which survives a change of programme.',
          example: '2022-09-26',
        },
        {
          name: 'isInternational',
          range: 'boolean',
          definition: 'Whether the student is classed as international for fees.',
          comment: 'A fee status, not a nationality: the two come apart often.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Instructor',
      parent: 'Person',
      at: [320, 340],
      definition: 'A member of academic staff who teaches.',
      comment: 'The teaching role. Research-only staff would need a sibling class or a wider one.',
      example: 'A senior lecturer.',
      attributes: [
        {
          name: 'staffNumber',
          range: 'string',
          definition: 'The payroll identifier for this member of staff.',
          comment: 'Separate from a student number, which the same person may also hold.',
          example: 'S-40118',
        },
        {
          name: 'academicTitle',
          range: 'string',
          definition: 'The rank the post carries.',
          comment: 'Text, because the ladder differs between countries and even between faculties.',
          example: 'Senior Lecturer',
        },
        {
          name: 'appointedOn',
          range: 'date',
          definition: 'The day the appointment began.',
          comment: 'The current post, so a promotion within the university does not reset it.',
          example: '2016-01-04',
        },
      ],
    },
    {
      name: 'Faculty',
      at: [640, 40],
      definition: 'A top-level academic division of the university.',
      comment:
        'The widest unit here; anything above it is the university itself, which is not modelled.',
      example: 'The Faculty of Science.',
      attributes: [
        {
          name: 'facultyName',
          range: 'string',
          definition: 'What the division is called.',
          comment: 'The public name, which is what appears on a degree certificate.',
          example: 'Faculty of Science',
        },
        {
          name: 'deanName',
          range: 'string',
          definition: 'Who currently leads the faculty.',
          comment:
            'Text rather than a link to Person, which is the shortcut this example takes; a real registry would point at the person.',
          example: 'Prof. Wei Chen',
        },
      ],
    },
    {
      name: 'Department',
      at: [640, 340],
      definition: 'An academic unit within a faculty.',
      comment: 'Where teaching and research actually sit, which is why programmes hang off it.',
      example: 'The Department of Computer Science.',
      attributes: [
        {
          name: 'departmentName',
          range: 'string',
          definition: 'What the unit is called.',
          comment: 'The name in the prospectus.',
          example: 'Computer Science',
        },
        {
          name: 'departmentCode',
          range: 'string',
          definition: 'The short code used in course codes and timetables.',
          comment: 'What the first letters of a course code come from.',
          example: 'CS',
        },
        {
          name: 'budget',
          range: 'decimal',
          definition: 'The annual budget allocated to the unit.',
          comment: 'Decimal so money is not rounded; the currency is left out, as elsewhere here.',
          example: '4250000.00',
        },
      ],
    },
    {
      name: 'ResearchGroup',
      at: [640, 640],
      definition: 'A group of staff working on a shared research theme.',
      comment:
        'Sits under a department through the same partOf relation as a department under a faculty, which is why that property is drawn twice.',
      example: 'The Programming Languages group.',
      attributes: [
        {
          name: 'groupName',
          range: 'string',
          definition: 'What the group calls itself.',
          comment: 'Chosen by the group, so it has none of the formality of a department name.',
          example: 'Programming Languages',
        },
        {
          name: 'researchTheme',
          range: 'string',
          definition: 'What the group works on.',
          comment:
            'A sentence rather than a subject classification, which nobody agrees on anyway.',
          example: 'Type systems and program verification',
        },
        {
          name: 'foundedOn',
          range: 'date',
          definition: 'The day the group was formed.',
          comment: 'Formation, which for most groups is when it was first funded.',
          example: '2014-10-01',
        },
      ],
    },
    {
      name: 'Programme',
      at: [960, 40],
      definition: 'A named qualification a student is admitted to.',
      comment: 'What a student is admitted to, as against a course, which they merely take.',
      example: 'BSc Computer Science.',
      attributes: [
        {
          name: 'programmeName',
          range: 'string',
          definition: 'What the qualification is called.',
          comment: 'The name as advertised and as printed on the certificate.',
          example: 'Computer Science',
        },
        {
          name: 'award',
          range: 'string',
          definition: 'The qualification granted on completion.',
          comment: 'Held apart from the name, so BSc and MSc versions can share one.',
          example: 'BSc (Hons)',
        },
        {
          name: 'durationYears',
          range: 'integer',
          definition: 'How long the programme takes full time.',
          comment: 'The full-time length; part-time study stretches it without changing this.',
          example: '3',
        },
        {
          name: 'totalCredits',
          range: 'integer',
          definition: 'Credits needed to complete the programme.',
          comment: 'What the credits on each course have to add up to.',
          example: '360',
        },
      ],
    },
    {
      name: 'Course',
      at: [960, 340],
      definition: 'A unit of teaching as it appears in the catalogue.',
      comment:
        'The catalogue entry, which exists whether or not it runs this year. Anything that varies by term belongs on CourseOffering — the distinction this example is built around.',
      example: 'CS2010 Algorithms.',
      attributes: [
        {
          name: 'courseCode',
          range: 'string',
          definition: 'The catalogue identifier for the course.',
          comment: 'Stable across years, which is what makes a transcript readable a decade later.',
          example: 'CS2010',
        },
        {
          name: 'courseTitle',
          range: 'string',
          definition: 'What the course is called.',
          comment: 'The catalogue title, which changes far less often than the syllabus.',
          example: 'Algorithms and Data Structures',
        },
        {
          name: 'credits',
          range: 'integer',
          definition: 'Credit awarded for passing the course.',
          comment: 'A property of the course, not of any one running of it.',
          example: '20',
        },
        {
          name: 'level',
          range: 'integer',
          definition: 'The year of study the course is pitched at.',
          comment: 'A number so courses can be sorted; what each level means is institutional.',
          example: '2',
        },
        {
          name: 'syllabus',
          range: 'string',
          definition: 'What the course covers.',
          comment: 'The catalogue description; the week-by-week plan belongs to an offering.',
          example: 'Sorting, searching, graph traversal and complexity analysis.',
        },
      ],
    },
    {
      name: 'CourseOffering',
      at: [1280, 340],
      definition: 'One running of a course in one term, with its own timetable and staff.',
      comment:
        'The other half of the distinction. Students enrol in an offering, not a course: a room, a capacity and a set of dates only make sense here.',
      example: 'CS2010 in autumn 2024.',
      attributes: [
        {
          name: 'term',
          range: 'string',
          definition: 'The part of the year this offering runs in.',
          comment: 'Text, because terms, semesters and trimesters do not share a scheme.',
          example: 'Autumn',
        },
        {
          name: 'academicYear',
          range: 'string',
          definition: 'The academic year this offering belongs to.',
          comment: 'A string because an academic year spans two calendar years.',
          example: '2024/25',
        },
        {
          name: 'capacity',
          range: 'integer',
          definition: 'How many students may enrol.',
          comment: 'Set per offering, usually by the room, which is why it is not on the course.',
          example: '120',
        },
        {
          name: 'startsOn',
          range: 'date',
          definition: 'The first day of teaching.',
          comment: 'Teaching, not registration, which opens well before.',
          example: '2024-09-30',
        },
        {
          name: 'endsOn',
          range: 'date',
          definition: 'The last day of teaching.',
          comment: 'The end of teaching; assessment usually runs past it.',
          example: '2024-12-13',
        },
      ],
    },
    {
      name: 'Enrolment',
      at: [1280, 640],
      definition: 'One student taking one offering, and how they did on it.',
      comment:
        'A class rather than a relation, because the result belongs to neither the student nor the offering alone. The same shape as RecipeIngredient in the recipes example.',
      example: 'Wei Chen on CS2010, autumn 2024.',
      attributes: [
        {
          name: 'enrolledOn',
          range: 'date',
          definition: 'The day the student registered for the offering.',
          comment: 'Registration for this offering, not admission to the programme.',
          example: '2024-09-16',
        },
        {
          name: 'mark',
          range: 'decimal',
          definition: 'The numeric result the student was awarded.',
          comment: 'Decimal because marks are often carried to one place before being rounded.',
          example: '72.5',
        },
        {
          name: 'grade',
          range: 'string',
          definition: 'The result on the letter or class scale.',
          comment: 'Held beside the mark rather than derived, because the boundaries move.',
          example: 'A',
        },
        {
          name: 'hasPassed',
          range: 'boolean',
          definition: 'Whether the student passed.',
          comment:
            'Stated rather than worked out from the mark, which compensation rules complicate.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Assessment',
      at: [1600, 340],
      definition: 'A piece of assessed work set on an offering.',
      comment: 'Attached to the offering, so a coursework deadline can move between years.',
      example: 'The autumn 2024 coursework.',
      attributes: [
        {
          name: 'assessmentTitle',
          range: 'string',
          definition: 'What the piece of work is called.',
          comment: 'What appears on the deadline list students actually read.',
          example: 'Graph algorithms coursework',
        },
        {
          name: 'assessmentType',
          range: 'string',
          definition: 'What kind of assessment it is.',
          comment: 'Text rather than a class, which keeps the example from sprouting a vocabulary.',
          example: 'Coursework',
        },
        {
          name: 'weighting',
          range: 'decimal',
          definition: 'What share of the course mark this carries.',
          comment: 'A proportion; the weightings on one offering should total one.',
          example: '0.4',
        },
        {
          name: 'dueOn',
          range: 'dateTime',
          definition: 'When the work must be submitted.',
          comment:
            'A time as well as a date, because a deadline is an hour and lateness is minutes.',
          example: '2024-11-22T16:00:00',
        },
      ],
    },
    {
      name: 'Building',
      at: [40, 640],
      definition: 'A building on campus.',
      comment: 'Present so rooms have somewhere to be, and so accessibility can be asked about.',
      example: 'The Cockcroft Building.',
      attributes: [
        {
          name: 'buildingName',
          range: 'string',
          definition: 'What the building is called.',
          comment: 'The name on the signage and the campus map.',
          example: 'Cockcroft Building',
        },
        {
          name: 'address',
          range: 'string',
          definition: 'Where the building is.',
          comment: 'A full address, unlike the city-only fields elsewhere: people have to find it.',
          example: '14 Mill Lane, Leeds',
        },
        {
          name: 'hasStepFreeAccess',
          range: 'boolean',
          definition: 'Whether the building can be entered and used without steps.',
          comment: 'On the building rather than the room, which is where it is first decided.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Room',
      at: [320, 640],
      definition: 'A room on campus that teaching is timetabled into.',
      comment:
        'Only teaching space. Offices and labs would widen this beyond what the example needs.',
      example: 'Lecture theatre 1.02.',
      attributes: [
        {
          name: 'roomNumber',
          range: 'string',
          definition: 'How the room is identified within its building.',
          comment: 'A string, because room numbers carry letters and dots.',
          example: '1.02',
        },
        {
          name: 'seats',
          range: 'integer',
          definition: 'How many people the room holds.',
          comment: 'What an offering capacity is usually set from.',
          example: '150',
        },
        {
          name: 'floor',
          range: 'integer',
          definition: 'Which floor the room is on.',
          comment: 'Ground floor is zero here, which is a convention worth stating.',
          example: '1',
        },
      ],
    },
    {
      name: 'Publication',
      at: [960, 640],
      definition: 'A piece of published research produced by people here.',
      comment: 'Points at Person rather than Instructor, so students and external co-authors fit.',
      example: 'A conference paper.',
      attributes: [
        {
          name: 'publicationTitle',
          range: 'string',
          definition: 'The title of the work.',
          comment: 'As published, which is what a citation has to match.',
          example: 'A verified compiler for a subset of ML',
        },
        {
          name: 'doi',
          range: 'anyURI',
          label: 'DOI',
          definition: 'The Digital Object Identifier for the work.',
          comment: 'A URI, so it resolves; the bare code form would not.',
          example: 'https://doi.org/10.1000/182',
        },
        {
          name: 'publishedOn',
          range: 'date',
          definition: 'The day the work was published.',
          comment: 'Publication, which can be long after acceptance.',
          example: '2023-06-14',
        },
        {
          name: 'venue',
          range: 'string',
          definition: 'The journal or conference it appeared in.',
          comment: 'Text rather than a class, which a bibliographic model would not accept.',
          example: 'ICFP 2023',
        },
        {
          name: 'citationCount',
          range: 'integer',
          definition: 'How many other works cite this one.',
          comment: 'A figure at a moment in time, and only ever as good as its source.',
          example: '37',
        },
      ],
    },
  ],

  relations: [
    // Drawn twice, so one property serves both kinds of membership.
    {
      name: 'partOf',
      from: 'Department',
      to: 'Faculty',
      definition: 'The larger academic unit this one belongs to.',
      comment:
        'Drawn twice — department under faculty, research group under department — so one property serves both kinds of membership rather than two nearly identical ones.',
      example: 'Computer Science is partOf the Faculty of Science.',
    },
    { name: 'partOf', from: 'ResearchGroup', to: 'Department' },
    {
      name: 'offers',
      from: 'Department',
      to: 'Programme',
      definition: 'A qualification this department runs.',
      comment: 'Jointly run programmes would need this drawn from more than one department.',
      example: 'Computer Science offers BSc Computer Science.',
    },
    {
      name: 'includesCourse',
      from: 'Programme',
      to: 'Course',
      definition: 'A course that counts towards this programme.',
      comment:
        'Whether the course is compulsory or optional is not captured, which would need a class between the two.',
      example: 'BSc Computer Science includesCourse CS2010.',
    },
    {
      name: 'hasOffering',
      from: 'Course',
      to: 'CourseOffering',
      definition: 'One running of this course.',
      comment: 'The link that carries the catalogue-versus-offering distinction.',
      example: 'CS2010 hasOffering CS2010 in autumn 2024.',
    },
    // A course pointing at a course: perfectly legal, and worth seeing drawn.
    {
      name: 'prerequisiteOf',
      from: 'Course',
      to: 'Course',
      definition: 'A course that must be passed before this one may be taken.',
      comment:
        'From a class to itself, which is legal and worth seeing drawn. It points one way, so the graph of prerequisites cannot close a loop by accident.',
      example: 'CS1010 is a prerequisiteOf CS2010.',
    },
    {
      name: 'taughtBy',
      from: 'CourseOffering',
      to: 'Instructor',
      definition: 'A member of staff teaching this offering.',
      comment: 'On the offering, so who teaches a course can change from year to year.',
      example: 'CS2010 in autumn 2024 is taughtBy Wei Chen.',
    },
    {
      name: 'heldIn',
      from: 'CourseOffering',
      to: 'Room',
      definition: 'Where this offering is taught.',
      comment: 'One room, which a course split across a lecture theatre and labs will defeat.',
      example: 'CS2010 in autumn 2024 is heldIn room 1.02.',
    },
    {
      name: 'hasAssessment',
      from: 'CourseOffering',
      to: 'Assessment',
      definition: 'A piece of assessed work set on this offering.',
      comment: 'Per offering, so deadlines and weightings can change between years.',
      example: 'CS2010 in autumn 2024 hasAssessment the graph coursework.',
    },
    {
      name: 'forOffering',
      from: 'Enrolment',
      to: 'CourseOffering',
      definition: 'The offering this enrolment is on.',
      comment: 'One half of the pairing Enrolment exists to hold.',
      example: "Wei Chen's enrolment is forOffering CS2010 in autumn 2024.",
    },
    {
      name: 'byStudent',
      from: 'Enrolment',
      to: 'Student',
      definition: 'The student this enrolment belongs to.',
      comment: 'The other half of the pairing, which together make the mark mean something.',
      example: 'The autumn CS2010 enrolment is byStudent Wei Chen.',
    },
    {
      name: 'enrolledOnProgramme',
      from: 'Student',
      to: 'Programme',
      definition: 'The qualification this student is working towards.',
      comment: 'Admission to a programme, which is separate from taking any of its courses.',
      example: 'Wei Chen is enrolledOnProgramme BSc Computer Science.',
    },
    {
      name: 'supervisedBy',
      from: 'Student',
      to: 'Instructor',
      definition: 'The member of staff responsible for this student.',
      comment:
        'Covers both a personal tutor and a research supervisor, which are rarely distinguished.',
      example: 'Wei Chen is supervisedBy Dr Okonkwo.',
    },
    {
      name: 'memberOf',
      from: 'Instructor',
      to: 'ResearchGroup',
      definition: 'A research group this member of staff belongs to.',
      comment: 'More than one is normal, and none of them is the primary group.',
      example: 'Dr Okonkwo is memberOf Programming Languages.',
    },
    {
      name: 'authoredBy',
      from: 'Publication',
      to: 'Person',
      definition: 'Someone who wrote this work.',
      comment:
        'Points at Person rather than Instructor, so students and outside collaborators fit. Author order is not captured.',
      example: 'The ML compiler paper is authoredBy Wei Chen.',
    },
    {
      name: 'locatedIn',
      from: 'Room',
      to: 'Building',
      definition: 'The building this room is in.',
      comment: 'What makes a room number meaningful, since they repeat across buildings.',
      example: 'Room 1.02 is locatedIn the Cockcroft Building.',
    },
  ],
});
