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
  ],

  classes: [
    {
      name: 'Artist',
      at: [40, 40],
      definition: 'Anyone credited with making music.',
      labels: [
        ['Artist', 'en'],
        ['Artiest', 'nl'],
      ],
      attributes: [
        ['artistName', 'string'],
        ['formedIn', 'integer'],
        ['countryOfOrigin', 'string'],
        ['isActive', 'boolean'],
        ['website', 'anyURI'],
      ],
    },
    {
      name: 'SoloArtist',
      parent: 'Artist',
      at: [40, 360],
      definition: 'One person performing under their own name.',
      attributes: [
        ['realName', 'string'],
        ['dateOfBirth', 'date'],
        ['mainInstrument', 'string'],
      ],
    },
    {
      name: 'Band',
      parent: 'Artist',
      at: [320, 360],
      definition: 'A group performing together under one name.',
      attributes: [
        ['memberCount', 'integer'],
        ['disbandedIn', 'integer'],
      ],
    },
    {
      name: 'Musician',
      at: [320, 660],
      definition: 'A person who plays in a band.',
      attributes: [
        ['fullName', 'string'],
        ['instrument', 'string'],
        ['joinedOn', 'date'],
      ],
    },
    {
      name: 'Release',
      at: [660, 40],
      definition: 'A published body of recorded music.',
      attributes: [
        ['releaseTitle', 'string'],
        ['releasedOn', 'date'],
        ['catalogueNumber', 'string'],
        ['trackCount', 'integer'],
        ['isRemastered', 'boolean'],
      ],
    },
    {
      name: 'Album',
      parent: 'Release',
      at: [660, 360],
      definition: 'A full-length release.',
      attributes: [['isDoubleAlbum', 'boolean']],
    },
    {
      name: 'Single',
      parent: 'Release',
      at: [940, 360],
      definition: 'A short release built around one track.',
      attributes: [['chartPeak', 'integer']],
    },
    {
      name: 'Track',
      at: [1280, 40],
      definition: 'One recorded piece of music.',
      attributes: [
        ['trackTitle', 'string'],
        ['trackNumber', 'integer'],
        ['durationSeconds', 'integer'],
        ['isExplicit', 'boolean'],
        ['isrc', 'string'],
        ['bpm', 'integer'],
      ],
    },
    {
      name: 'Genre',
      at: [1280, 360],
      definition: 'A style of music.',
      attributes: [
        ['genreName', 'string'],
        ['originatedIn', 'integer'],
      ],
    },
    {
      name: 'RecordLabel',
      at: [660, 660],
      definition: 'A company that publishes releases.',
      attributes: [
        ['labelName', 'string'],
        ['foundedIn', 'integer'],
        ['headquarters', 'string'],
      ],
    },
    {
      name: 'Concert',
      at: [1600, 40],
      definition: 'A live performance.',
      attributes: [
        ['performedOn', 'dateTime'],
        ['ticketPrice', 'decimal'],
        ['attendance', 'integer'],
        ['isSoldOut', 'boolean'],
      ],
    },
    {
      name: 'Venue',
      at: [1600, 360],
      definition: 'A place where concerts happen.',
      attributes: [
        ['venueName', 'string'],
        ['city', 'string'],
        ['capacity', 'integer'],
        ['isOutdoor', 'boolean'],
      ],
    },
    {
      name: 'Playlist',
      at: [1280, 660],
      definition: 'A user-made ordered selection of tracks.',
      attributes: [
        ['playlistName', 'string'],
        ['createdOn', 'date'],
        ['isPublic', 'boolean'],
      ],
    },
  ],

  relations: [
    // One property covering both the studio and the stage.
    {
      name: 'performedBy',
      from: 'Track',
      to: 'Artist',
      definition: 'The artist who performed this.',
    },
    { name: 'performedBy', from: 'Concert', to: 'Artist' },
    { name: 'appearsOn', from: 'Track', to: 'Release' },
    { name: 'releasedBy', from: 'Release', to: 'Artist' },
    { name: 'publishedBy', from: 'Release', to: 'RecordLabel' },
    { name: 'hasGenre', from: 'Release', to: 'Genre' },
    { name: 'hasMember', from: 'Band', to: 'Musician' },
    { name: 'heldAt', from: 'Concert', to: 'Venue' },
    { name: 'includesTrack', from: 'Playlist', to: 'Track' },
    { name: 'coverOf', from: 'Track', to: 'Track', definition: 'A track this one reinterprets.' },
    { name: 'influencedBy', from: 'Artist', to: 'Artist' },
    { name: 'leadTrack', from: 'Single', to: 'Track' },
  ],
});
