import { asExample } from './builder';

/**
 * A music library. Almost everyone already holds this model in their head, which makes it a
 * good first thing to open: the only real modelling decision is that a `Track` belongs to a
 * `Release` rather than directly to an `Artist`, and `performedBy` is drawn from both
 * `Track` and `Concert` so one property covers studio and stage.
 */
export const music = asExample({
  key: 'music',
  title: 'Music library',
  summary:
    'Artists, releases, tracks and gigs. The gentlest place to start — everyone already knows this domain, so the modelling is all that is new.',
  iri: 'https://example.org/music/',
  prefix: 'mus',
  metadata: [
    ['dcterms:title', 'Music Catalogue', 'en'],
    [
      'dcterms:description',
      'A schema covering recorded music, the people who make it and the places it is played.',
      'en',
    ],
    ['dcterms:creator', 'OntoSchema examples'],
    ['owl:versionInfo', '1.0.0'],
  ],

  classes: [
    {
      name: 'Artist',
      at: [40, 40],
      definition: 'Anyone credited with making music, whether one person or a group.',
      comment:
        'Deliberately above the split between a solo performer and a band, so a credit can point here without deciding which it is.',
      example: 'Miles Davis, or Fleetwood Mac.',
      labels: [
        ['Artist', 'en'],
        ['Artiest', 'nl'],
      ],
      attributes: [
        {
          name: 'artistName',
          range: 'string',
          definition: 'The name the artist releases music under.',
          comment: 'The performing name, which for a solo artist need not be their legal one.',
          example: 'Nina Simone',
        },
        {
          name: 'formedIn',
          range: 'integer',
          definition: 'The year the artist began releasing or performing.',
          comment: 'A year rather than a date: the month a band formed is rarely agreed on.',
          example: '1967',
        },
        {
          name: 'countryOfOrigin',
          range: 'string',
          definition: 'Where the artist started out.',
          comment:
            'Where they began, not where they live now, so a discography stays sorted the way listeners expect.',
          example: 'Nigeria',
        },
        {
          name: 'isActive',
          range: 'boolean',
          definition: 'Whether the artist is still recording or performing.',
          comment: 'Says nothing about why they stopped; a hiatus and a breakup look the same.',
          example: 'false',
        },
        {
          name: 'website',
          range: 'anyURI',
          definition: 'The official site for the artist.',
          comment: 'One address, the one the artist controls, not every page that mentions them.',
          example: 'https://example.org/artists/nina-simone',
        },
      ],
    },
    {
      name: 'SoloArtist',
      parent: 'Artist',
      at: [40, 360],
      definition: 'One person performing under their own name or a stage name.',
      comment:
        'A solo artist may also be a member of a band; the two are not exclusive, which is why membership is a relation rather than a subclass.',
      example: 'Nina Simone, recording alone.',
      attributes: [
        {
          name: 'realName',
          range: 'string',
          definition: 'The name the performer was born with.',
          comment: 'Held apart from the performing name so both can be searched.',
          example: 'Eunice Kathleen Waymon',
        },
        {
          name: 'dateOfBirth',
          range: 'date',
          definition: 'The day the performer was born.',
          comment: 'A full date here, unlike a band, because a birthday is a matter of record.',
          example: '1933-02-21',
        },
        {
          name: 'mainInstrument',
          range: 'string',
          definition: 'The instrument the performer is best known for.',
          comment: 'One instrument, the signature one; the rest belong in a fuller model.',
          example: 'Piano',
        },
      ],
    },
    {
      name: 'Band',
      parent: 'Artist',
      at: [320, 360],
      definition: 'A group of musicians performing together under one name.',
      comment:
        'The band is the artist, not the people in it: a line-up change leaves the credit intact.',
      example: 'Fleetwood Mac.',
      attributes: [
        {
          name: 'memberCount',
          range: 'integer',
          definition: 'How many musicians are in the current line-up.',
          comment:
            'A convenience for display. The line-up itself is held by hasMember, which is the version that can be queried.',
          example: '5',
        },
        {
          name: 'disbandedIn',
          range: 'integer',
          definition: 'The year the band stopped performing together.',
          comment: 'Absent while the band is active, which is what isActive on Artist reports.',
          example: '1995',
        },
      ],
    },
    {
      name: 'Musician',
      at: [320, 660],
      definition: 'A person who plays in a band.',
      comment:
        'Not a subclass of Artist: someone can play in a band for years without ever being credited as one.',
      example: 'The drummer on a 1973 tour.',
      attributes: [
        {
          name: 'fullName',
          range: 'string',
          definition: "The musician's full personal name.",
          comment: 'A person, so no stage name here — that belongs to whoever they record as.',
          example: 'Christine McVie',
        },
        {
          name: 'instrument',
          range: 'string',
          definition: 'What the musician plays in this band.',
          comment: 'What they play here, which may not be what they are known for elsewhere.',
          example: 'Keyboards',
        },
        {
          name: 'joinedOn',
          range: 'date',
          definition: 'The day the musician joined the band.',
          comment:
            'On the musician rather than on the membership, which is the simplification this example accepts: a member who leaves and returns keeps one date.',
          example: '1970-08-01',
        },
      ],
    },
    {
      name: 'Release',
      at: [660, 40],
      definition: 'A published body of recorded music, issued as one thing.',
      comment:
        'The published object, not the recording session: the same tracks reissued later are a second release.',
      example: 'Kind of Blue, Columbia, 1959.',
      attributes: [
        {
          name: 'releaseTitle',
          range: 'string',
          definition: 'The title the release was published under.',
          comment: 'Named apart from a track title, which a release may happen to share.',
          example: 'Kind of Blue',
        },
        {
          name: 'releasedOn',
          range: 'date',
          definition: 'The day the release first went on sale.',
          comment: 'The first issue. A remaster gets its own release rather than a second date.',
          example: '1959-08-17',
        },
        {
          name: 'catalogueNumber',
          range: 'string',
          definition: "The label's own identifier for this release.",
          comment: 'A string, not a number: catalogue numbers carry letters and punctuation.',
          example: 'CL 1355',
        },
        {
          name: 'trackCount',
          range: 'integer',
          definition: 'How many tracks the release contains.',
          comment: 'Redundant against appearsOn, and kept because a listing shows it everywhere.',
          example: '5',
        },
        {
          name: 'isRemastered',
          range: 'boolean',
          definition: 'Whether this issue has been remastered from the original tapes.',
          comment: 'A property of this issue, which is why a remaster is a release of its own.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Album',
      parent: 'Release',
      at: [660, 360],
      definition: 'A full-length release, long enough to stand as a body of work.',
      comment:
        'The line between an album and a single is one of length and intent, and every label draws it differently.',
      example: 'Kind of Blue.',
      attributes: [
        {
          name: 'isDoubleAlbum',
          range: 'boolean',
          definition: 'Whether the album was issued across two discs.',
          comment: 'A fact about the physical issue, which survives into how a CD is reissued.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Single',
      parent: 'Release',
      at: [940, 360],
      definition: 'A short release built around one track.',
      comment:
        'Still a release, so it carries a catalogue number and a label like any other; leadTrack is what makes it a single.',
      example: 'Go Your Own Way, 1976.',
      attributes: [
        {
          name: 'chartPeak',
          range: 'integer',
          definition: 'The highest chart position the single reached.',
          comment:
            'Which chart is left out, which is the simplification: a real catalogue needs one figure per territory.',
          example: '10',
        },
      ],
    },
    {
      name: 'Track',
      at: [1280, 40],
      definition: 'One recorded piece of music.',
      comment:
        'Belongs to a release rather than to an artist, so the same recording appearing on a compilation is one track on two releases.',
      example: 'So What.',
      attributes: [
        {
          name: 'trackTitle',
          range: 'string',
          definition: 'The name of the recording.',
          comment: 'Named apart from the release title, which it can legitimately duplicate.',
          example: 'So What',
        },
        {
          name: 'trackNumber',
          range: 'integer',
          definition: 'Where the track sits in the running order.',
          comment:
            'Position on the release, so a track on two releases has two numbers — the reason a fuller model would put this on appearsOn.',
          example: '1',
        },
        {
          name: 'durationSeconds',
          range: 'integer',
          definition: 'How long the recording runs, in seconds.',
          comment:
            'Seconds rather than a formatted string, so durations can be added and compared.',
          example: '562',
        },
        {
          name: 'isExplicit',
          range: 'boolean',
          definition: 'Whether the recording carries an explicit-content warning.',
          comment: 'The advisory as issued, not a judgement about the lyrics.',
          example: 'false',
        },
        {
          name: 'isrc',
          range: 'string',
          label: 'ISRC',
          definition: 'The International Standard Recording Code identifying this recording.',
          comment:
            'Identifies the recording itself, so it follows the track onto every release it appears on.',
          example: 'USSM15900001',
        },
        {
          name: 'bpm',
          range: 'integer',
          label: 'BPM',
          definition: 'The tempo of the recording in beats per minute.',
          comment: 'One figure for the whole track, which a piece that changes tempo will defeat.',
          example: '136',
        },
      ],
    },
    {
      name: 'Genre',
      at: [1280, 360],
      definition: 'A style of music that releases can be grouped by.',
      comment:
        'Attached to the release rather than the track, because a release is what gets shelved under a genre.',
      example: 'Modal jazz.',
      attributes: [
        {
          name: 'genreName',
          range: 'string',
          definition: 'What the style is called.',
          comment: 'The common name; genres have no authority to defer to.',
          example: 'Modal jazz',
        },
        {
          name: 'originatedIn',
          range: 'integer',
          definition: 'The year the style is generally held to have emerged.',
          comment: 'Approximate by nature, which is why it is a year and not a date.',
          example: '1958',
        },
      ],
    },
    {
      name: 'RecordLabel',
      at: [660, 660],
      definition: 'A company that publishes releases.',
      comment:
        'The publisher, kept separate from the artist so a catalogue can be browsed either way.',
      example: 'Columbia Records.',
      attributes: [
        {
          name: 'labelName',
          range: 'string',
          definition: 'The name the label trades under.',
          comment: 'The imprint, which may differ from the company that owns it.',
          example: 'Columbia Records',
        },
        {
          name: 'foundedIn',
          range: 'integer',
          definition: 'The year the label was founded.',
          comment: 'The founding year of the imprint, not of any parent company.',
          example: '1887',
        },
        {
          name: 'headquarters',
          range: 'string',
          definition: 'The city the label operates from.',
          comment: 'A city, not a full address: this is for grouping, not for post.',
          example: 'New York',
        },
      ],
    },
    {
      name: 'Concert',
      at: [1600, 40],
      definition: 'A live performance given on a particular date at a particular place.',
      comment:
        'One performance, not a tour: a tour is the set of concerts, which this example leaves out.',
      example: 'The Newport Jazz Festival set, 17 July 1958.',
      attributes: [
        {
          name: 'performedOn',
          range: 'dateTime',
          definition: 'When the performance began.',
          comment: 'A time as well as a date, because two sets in one day are two concerts.',
          example: '1958-07-17T20:30:00',
        },
        {
          name: 'ticketPrice',
          range: 'decimal',
          definition: 'What a standard ticket cost.',
          comment:
            'Decimal rather than float, so money is not rounded; the currency is left out, which a real model would need.',
          example: '42.50',
        },
        {
          name: 'attendance',
          range: 'integer',
          definition: 'How many people came.',
          comment: 'Counted at the door, so it can fall short of the capacity of the venue.',
          example: '1800',
        },
        {
          name: 'isSoldOut',
          range: 'boolean',
          definition: 'Whether every ticket was sold.',
          comment:
            'Recorded rather than derived: a concert can sell out and still have empty seats.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Venue',
      at: [1600, 360],
      definition: 'A place where concerts are held.',
      comment: 'The place, which outlives any one concert and usually any one artist.',
      example: 'Freebody Park, Newport.',
      attributes: [
        {
          name: 'venueName',
          range: 'string',
          definition: 'What the venue is called.',
          comment: 'The current name; venues are renamed often, and only the latest is kept here.',
          example: 'Freebody Park',
        },
        {
          name: 'city',
          range: 'string',
          definition: 'The town or city the venue is in.',
          comment: 'A city rather than a full address, which is what listings are grouped by.',
          example: 'Newport',
        },
        {
          name: 'capacity',
          range: 'integer',
          definition: 'The largest audience the venue can hold.',
          comment: 'The licensed figure, which a standing configuration can exceed on paper.',
          example: '5000',
        },
        {
          name: 'isOutdoor',
          range: 'boolean',
          definition: 'Whether performances are in the open air.',
          comment: 'Worth its own field because it is what makes a date weather-dependent.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Playlist',
      at: [1280, 660],
      definition: 'An ordered selection of tracks put together by a listener.',
      comment:
        'Points at tracks rather than releases, which is what separates it from a compilation album.',
      example: 'Late night listening.',
      attributes: [
        {
          name: 'playlistName',
          range: 'string',
          definition: 'What the listener called it.',
          comment: 'Free text with no authority behind it, unlike a release title.',
          example: 'Late night listening',
        },
        {
          name: 'createdOn',
          range: 'date',
          definition: 'The day the playlist was made.',
          comment: 'When it was created, not when it was last changed.',
          example: '2024-03-11',
        },
        {
          name: 'isPublic',
          range: 'boolean',
          definition: 'Whether anyone can see the playlist.',
          comment: 'Visibility only. Who may edit it is a separate question this model skips.',
          example: 'true',
        },
      ],
    },
  ],

  relations: [
    // One property covering both the studio and the stage.
    {
      name: 'performedBy',
      from: 'Track',
      to: 'Artist',
      definition: 'The artist who performed this recording or this concert.',
      comment:
        'Drawn from both Track and Concert, so one property covers the studio and the stage. That is why it carries no single rdfs:domain in the export.',
      example: 'So What is performedBy Miles Davis.',
    },
    { name: 'performedBy', from: 'Concert', to: 'Artist' },
    {
      name: 'appearsOn',
      from: 'Track',
      to: 'Release',
      definition: 'The release this track was published on.',
      comment:
        'Many to many on purpose: a recording that appears on an album and a compilation is one track, drawn twice.',
      example: 'So What appearsOn Kind of Blue.',
    },
    {
      name: 'releasedBy',
      from: 'Release',
      to: 'Artist',
      definition: 'The artist the release is credited to.',
      comment: 'The credit on the sleeve, which is not always everyone who played on it.',
      example: 'Kind of Blue is releasedBy Miles Davis.',
    },
    {
      name: 'publishedBy',
      from: 'Release',
      to: 'RecordLabel',
      definition: 'The label that issued the release.',
      comment: 'The label for this issue; a reissue on another label is a separate release.',
      example: 'Kind of Blue is publishedBy Columbia Records.',
    },
    {
      name: 'hasGenre',
      from: 'Release',
      to: 'Genre',
      definition: 'A style this release is filed under.',
      comment: 'More than one is expected, and none of them is the primary genre.',
      example: 'Kind of Blue hasGenre Modal jazz.',
    },
    {
      name: 'hasMember',
      from: 'Band',
      to: 'Musician',
      definition: 'A musician who plays in this band.',
      comment:
        'Current and former members both, which is why Musician carries the date they joined.',
      example: 'Fleetwood Mac hasMember Christine McVie.',
    },
    {
      name: 'heldAt',
      from: 'Concert',
      to: 'Venue',
      definition: 'Where the concert took place.',
      comment: 'One venue per concert; a show that moves halfway through is two concerts.',
      example: 'The 1958 set was heldAt Freebody Park.',
    },
    {
      name: 'includesTrack',
      from: 'Playlist',
      to: 'Track',
      definition: 'A track the playlist contains.',
      comment:
        'The order the listener chose is not captured here, which is the honest limit of a plain relation.',
      example: 'Late night listening includesTrack So What.',
    },
    {
      name: 'coverOf',
      from: 'Track',
      to: 'Track',
      definition: 'An earlier recording that this one reinterprets.',
      comment:
        'From a class to itself, which is legal and common. It points one way: a cover knows its original, and the original knows nothing.',
      example: 'All Along the Watchtower (1968) is a coverOf All Along the Watchtower (1967).',
    },
    {
      name: 'influencedBy',
      from: 'Artist',
      to: 'Artist',
      definition: 'An artist whose work shaped this one.',
      comment:
        'A claim rather than a fact, and the reason this example keeps it deliberately vague.',
      example: 'Herbie Hancock is influencedBy Miles Davis.',
    },
    {
      name: 'leadTrack',
      from: 'Single',
      to: 'Track',
      definition: 'The track the single was built around.',
      comment: 'What makes a single a single, as against a short album.',
      example: 'Go Your Own Way has leadTrack Go Your Own Way.',
    },
  ],
});
