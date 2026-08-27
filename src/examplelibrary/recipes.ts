import { asExample } from './builder';

/**
 * A recipe collection. The one genuinely instructive wrinkle is `RecipeIngredient`: a recipe
 * does not simply point at "flour", it needs *how much* flour, and a quantity belongs to
 * neither the recipe nor the ingredient on its own. Reaching for a class to hold the pairing
 * is the single most useful modelling habit this example can teach.
 */
export const recipes = asExample({
  key: 'recipes',
  title: 'Recipes and cooking',
  summary:
    'Recipes, what goes into them and who cooks them. Teaches the most common modelling lesson there is: when a link needs its own facts, it needs its own class.',
  iri: 'https://example.org/cooking/',
  prefix: 'cook',
  metadata: [
    ['dcterms:title', 'Recipe Collection', 'en'],
    [
      'dcterms:description',
      'A schema covering recipes, ingredients, quantities, methods and the people who cook them.',
      'en',
    ],
    ['dcterms:creator', 'OntoSchema examples'],
    ['owl:versionInfo', '1.0.0'],
  ],

  classes: [
    {
      name: 'Recipe',
      at: [40, 40],
      definition: 'Instructions for making one dish, with its ingredients and its method.',
      comment:
        'The written recipe, not an occasion of cooking it: what someone thought of the result belongs on Review.',
      example: 'Tarte tatin.',
      labels: [
        ['Recipe', 'en'],
        ['Recept', 'nl'],
        ['Rezept', 'de'],
      ],
      attributes: [
        {
          name: 'recipeTitle',
          range: 'string',
          definition: 'The name the dish is published under.',
          comment: 'The name as written; the same dish under two names is two recipes here.',
          example: 'Tarte tatin',
        },
        {
          name: 'servings',
          range: 'integer',
          definition: 'How many people the quantities are written for.',
          comment:
            'What every quantity on RecipeIngredient is relative to, so it cannot be absent.',
          example: '6',
        },
        {
          name: 'prepMinutes',
          range: 'integer',
          definition: 'Hands-on time before cooking begins.',
          comment: 'Kept apart from cooking time because only one of the two needs attention.',
          example: '25',
        },
        {
          name: 'cookMinutes',
          range: 'integer',
          definition: 'Time the dish spends cooking.',
          comment: 'Total across the method, which the per-step durations should add up to.',
          example: '45',
        },
        {
          name: 'difficulty',
          range: 'string',
          definition: 'Roughly how demanding the recipe is.',
          comment:
            'A string because there is no agreed scale; a real collection would make this a class.',
          example: 'Moderate',
        },
        {
          name: 'isVegetarian',
          range: 'boolean',
          definition: 'Whether the recipe contains no meat or fish.',
          comment:
            'Recorded rather than worked out from the ingredients, because stock and rennet defeat the obvious calculation.',
          example: 'true',
        },
        {
          name: 'isVegan',
          range: 'boolean',
          definition: 'Whether the recipe contains no animal products at all.',
          comment: 'Stricter than isVegetarian, and never true where that one is false.',
          example: 'false',
        },
        {
          name: 'publishedOn',
          range: 'date',
          definition: 'The day the recipe was published.',
          comment: 'First publication, so a revised recipe keeps the original date.',
          example: '2023-09-14',
        },
        {
          name: 'sourceUrl',
          range: 'anyURI',
          label: 'Source URL',
          definition: 'Where the recipe was published or adapted from.',
          comment: 'Credit for an adaptation, which is why it is a URL and not a citation.',
          example: 'https://example.org/recipes/tarte-tatin',
        },
      ],
    },
    {
      name: 'RecipeIngredient',
      at: [400, 40],
      definition:
        'One ingredient as used in one recipe, together with how much of it that recipe needs.',
      comment:
        'The lesson of this example. A quantity belongs to neither the recipe nor the ingredient alone, so the pairing gets a class of its own — the move to reach for whenever a link needs facts attached to it.',
      example: '200g of plain flour, sifted, in the tarte tatin.',
      attributes: [
        {
          name: 'quantity',
          range: 'decimal',
          definition: 'How much of the ingredient is needed.',
          comment: 'Decimal because half an onion is a real amount; the unit is held beside it.',
          example: '200',
        },
        {
          name: 'unit',
          range: 'string',
          definition: 'What the quantity is measured in.',
          comment:
            'A string here, which is the compromise: a serious model would use a units vocabulary so amounts could be converted.',
          example: 'g',
        },
        {
          name: 'preparationNote',
          range: 'string',
          definition: 'What to do to the ingredient before it goes in.',
          comment:
            'Belongs to this use of the ingredient, not to the ingredient — flour is not inherently sifted.',
          example: 'sifted',
        },
        {
          name: 'isOptional',
          range: 'boolean',
          definition: 'Whether the dish works without this ingredient.',
          comment:
            'A property of the line rather than of the ingredient, which may be essential elsewhere.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Ingredient',
      at: [760, 40],
      definition: 'A foodstuff, described independently of any recipe that uses it.',
      comment:
        'Holds only what is true of the ingredient everywhere. Anything that varies by recipe lives on RecipeIngredient.',
      example: 'Plain flour.',
      labels: [
        ['Ingredient', 'en'],
        ['Ingrediënt', 'nl'],
      ],
      attributes: [
        {
          name: 'ingredientName',
          range: 'string',
          definition: 'What the foodstuff is called.',
          comment: 'The common name, which is why the same thing appears twice across regions.',
          example: 'Plain flour',
        },
        {
          name: 'caloriesPer100g',
          range: 'integer',
          label: 'Calories per 100g',
          definition: 'Energy in one hundred grams of the ingredient.',
          comment: 'Per fixed weight so ingredients can be compared and a dish totalled.',
          example: '364',
        },
        {
          name: 'isAllergen',
          range: 'boolean',
          definition: 'Whether the ingredient is a common allergen.',
          comment: 'A blunt flag. Which allergy it triggers is what DietaryRestriction is for.',
          example: 'true',
        },
        {
          name: 'storageAdvice',
          range: 'string',
          definition: 'How the ingredient should be kept.',
          comment: 'Free text, because the useful version of this is a sentence, not a category.',
          example: 'Airtight, away from light.',
        },
      ],
    },
    {
      name: 'IngredientCategory',
      at: [1100, 40],
      definition: 'A grouping of ingredients such as dairy, pulses or spices.',
      comment: 'Flat on purpose: nesting categories is a hierarchy this example does not need.',
      example: 'Dairy.',
      attributes: [
        {
          name: 'categoryName',
          range: 'string',
          definition: 'What the grouping is called.',
          comment: 'The shelf label, roughly — how a shop or a cupboard is organised.',
          example: 'Dairy',
        },
        {
          name: 'isPerishable',
          range: 'boolean',
          definition: 'Whether things in this category spoil quickly.',
          comment:
            'On the category rather than the ingredient, which is a deliberate simplification.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Step',
      at: [40, 380],
      definition: 'One instruction in the method of a recipe.',
      comment: 'Ordered by its own number rather than by the relation, which carries no order.',
      example: 'Caramelise the sugar in the pan.',
      attributes: [
        {
          name: 'stepNumber',
          range: 'integer',
          definition: 'Where this instruction comes in the method.',
          comment: 'The order lives here because hasStep is a plain relation and has none.',
          example: '3',
        },
        {
          name: 'instruction',
          range: 'string',
          definition: 'The action to carry out at this point in the method.',
          comment: 'One action per step; a step doing three things should have been three.',
          example: 'Caramelise the sugar until it is the colour of a copper coin.',
        },
        {
          name: 'durationMinutes',
          range: 'integer',
          definition: 'How long this step takes.',
          comment:
            'Should sum roughly to the cooking time on the recipe, though nothing enforces it.',
          example: '8',
        },
        {
          name: 'temperatureCelsius',
          range: 'integer',
          definition: 'The temperature this step calls for.',
          comment: 'Celsius by convention, so a temperature carries no unit of its own.',
          example: '180',
        },
      ],
    },
    {
      name: 'Equipment',
      at: [400, 380],
      definition: 'A tool or appliance that a step calls for.',
      comment:
        'Attached to the step rather than the recipe, so the equipment list can be worked out from the method.',
      example: 'A heavy ovenproof frying pan.',
      attributes: [
        {
          name: 'equipmentName',
          range: 'string',
          definition: 'What the tool is called.',
          comment: 'The everyday name, not a manufacturer or a model.',
          example: 'Ovenproof frying pan',
        },
        {
          name: 'isEssential',
          range: 'boolean',
          definition: 'Whether the step can be done without it.',
          comment: 'What separates equipment you must buy from equipment you can improvise.',
          example: 'true',
        },
      ],
    },
    {
      name: 'Cuisine',
      at: [760, 380],
      definition: 'A regional cooking tradition.',
      comment: 'A tradition rather than a country: the two rarely line up neatly.',
      example: 'French.',
      attributes: [
        {
          name: 'cuisineName',
          range: 'string',
          definition: 'What the tradition is called.',
          comment: 'The name in common use, which is usually an adjective.',
          example: 'French',
        },
        {
          name: 'region',
          range: 'string',
          definition: 'Where the tradition comes from.',
          comment: 'Broader or narrower than a country, which is why it is not one.',
          example: 'Western Europe',
        },
      ],
    },
    {
      name: 'Course',
      at: [1100, 380],
      definition: 'Where a dish falls in a meal: starter, main or dessert.',
      comment: 'A small closed set in practice, kept as a class so a collection can add to it.',
      example: 'Dessert.',
      attributes: [
        {
          name: 'courseName',
          range: 'string',
          definition: 'What the course is called.',
          comment: 'The name used at the table.',
          example: 'Dessert',
        },
        {
          name: 'servingOrder',
          range: 'integer',
          definition: 'Where the course comes in a meal.',
          comment: 'What lets courses be sorted without hard-coding the names.',
          example: '3',
        },
      ],
    },
    {
      name: 'Cook',
      at: [40, 700],
      definition: 'Someone who writes recipes or follows them.',
      comment: 'One class for both authors and reviewers, because the same person is usually both.',
      example: 'A home cook publishing to the collection.',
      attributes: [
        {
          name: 'cookName',
          range: 'string',
          definition: 'What the cook goes by.',
          comment: 'A display name, which need not be a legal one.',
          example: 'Delphine Roux',
        },
        {
          name: 'skillLevel',
          range: 'string',
          definition: 'How experienced the cook is.',
          comment: 'Self-declared, and matched loosely against recipe difficulty.',
          example: 'Confident',
        },
        {
          name: 'joinedOn',
          range: 'date',
          definition: 'The day the cook joined the collection.',
          comment: 'Membership of this collection, not when they learned to cook.',
          example: '2022-01-30',
        },
      ],
    },
    {
      name: 'ProfessionalChef',
      parent: 'Cook',
      at: [40, 1000],
      definition: 'A cook who does it for a living.',
      comment:
        'A subclass rather than a flag on Cook, because it brings facts of its own that make no sense on a home cook.',
      example: 'The head chef of a restaurant.',
      attributes: [
        {
          name: 'restaurantName',
          range: 'string',
          definition: 'Where the chef currently cooks.',
          comment: 'One kitchen, the current one; a career history is out of scope.',
          example: 'La Chèvre',
        },
        {
          name: 'michelinStars',
          range: 'integer',
          definition: 'Stars currently held by the restaurant.',
          comment:
            'Held by the restaurant rather than the chef, and kept here only because that is how it is spoken about.',
          example: '2',
        },
      ],
    },
    {
      name: 'Review',
      at: [400, 700],
      definition: 'What someone thought of a recipe after cooking it.',
      comment:
        'A class rather than a rating on the recipe, because it needs an author and a date of its own.',
      example: 'Four stars, would make again.',
      attributes: [
        {
          name: 'rating',
          range: 'integer',
          definition: 'The score given, out of five.',
          comment: 'A whole number: half stars are a display convention, not a stored value.',
          example: '4',
        },
        {
          name: 'comment',
          range: 'string',
          definition: 'What the reviewer wrote.',
          comment: 'Free prose, and the part that is actually read.',
          example: 'Needed ten minutes longer than stated, otherwise perfect.',
        },
        {
          name: 'reviewedOn',
          range: 'date',
          definition: 'The day the review was written.',
          comment: 'When it was written, which can be well after the cooking.',
          example: '2024-02-02',
        },
        {
          name: 'wouldCookAgain',
          range: 'boolean',
          definition: 'Whether the reviewer would make it a second time.',
          comment: 'Often more telling than the score, which is why it is asked separately.',
          example: 'true',
        },
      ],
    },
    {
      name: 'DietaryRestriction',
      at: [760, 700],
      definition: 'Something a diner cannot or will not eat.',
      comment:
        'Covers both medical need and choice, which is why isMedical exists rather than two classes.',
      example: 'Coeliac disease.',
      attributes: [
        {
          name: 'restrictionName',
          range: 'string',
          definition: 'What the restriction is called.',
          comment: 'Named as a diner would say it, not as a clinician would.',
          example: 'Gluten-free',
        },
        {
          name: 'isMedical',
          range: 'boolean',
          definition: 'Whether the restriction is a medical requirement.',
          comment:
            'The difference between a preference and an allergy, which changes how it is treated.',
          example: 'true',
        },
      ],
    },
    {
      name: 'MealPlan',
      at: [1100, 700],
      definition: 'Recipes chosen to be cooked over a period.',
      comment: 'Which recipe falls on which day is not held here, which is its honest limit.',
      example: 'A week of weeknight dinners.',
      attributes: [
        {
          name: 'planName',
          range: 'string',
          definition: 'What the plan is called.',
          comment: 'Free text chosen by whoever made the plan.',
          example: 'Weeknight dinners',
        },
        {
          name: 'startsOn',
          range: 'date',
          definition: 'The first day of the plan.',
          comment: 'With dayCount, this is what fixes the period the plan covers.',
          example: '2024-04-08',
        },
        {
          name: 'dayCount',
          range: 'integer',
          definition: 'How many days the plan runs for.',
          comment: 'A length rather than an end date, because plans are described that way.',
          example: '7',
        },
      ],
    },
  ],

  relations: [
    {
      name: 'usesIngredient',
      from: 'Recipe',
      to: 'RecipeIngredient',
      definition: 'An ingredient line belonging to this recipe.',
      comment:
        'Points at the pairing, not at the ingredient, which is what carries the amount. The step everyone skips first time.',
      example: 'Tarte tatin usesIngredient the 200g flour line.',
    },
    {
      name: 'refersTo',
      from: 'RecipeIngredient',
      to: 'Ingredient',
      definition: 'The foodstuff this ingredient line is about.',
      comment: 'The other half of the pairing, which is what makes the amount mean anything.',
      example: 'The 200g flour line refersTo Plain flour.',
    },
    {
      name: 'inCategory',
      from: 'Ingredient',
      to: 'IngredientCategory',
      definition: 'The grouping this ingredient belongs to.',
      comment: 'One category per ingredient here, which real shelving would not respect.',
      example: 'Butter is inCategory Dairy.',
    },
    {
      name: 'hasStep',
      from: 'Recipe',
      to: 'Step',
      definition: 'An instruction in this recipe method.',
      comment: 'Carries no order of its own, which is why Step numbers itself.',
      example: 'Tarte tatin hasStep "Caramelise the sugar".',
    },
    {
      name: 'requiresEquipment',
      from: 'Step',
      to: 'Equipment',
      definition: 'A tool this step needs.',
      comment: 'On the step rather than the recipe, so the equipment list follows from the method.',
      example: 'The caramel step requiresEquipment an ovenproof frying pan.',
    },
    {
      name: 'fromCuisine',
      from: 'Recipe',
      to: 'Cuisine',
      definition: 'The cooking tradition this recipe belongs to.',
      comment: 'A single tradition, which a fusion dish will happily contradict.',
      example: 'Tarte tatin is fromCuisine French.',
    },
    {
      name: 'servedAs',
      from: 'Recipe',
      to: 'Course',
      definition: 'Where in a meal the dish is served.',
      comment: 'More than one is normal: plenty of dishes work as a starter or a main.',
      example: 'Tarte tatin is servedAs Dessert.',
    },
    {
      name: 'createdBy',
      from: 'Recipe',
      to: 'Cook',
      definition: 'The cook who wrote this recipe.',
      comment: 'Authorship of the written recipe, not of the dish itself.',
      example: 'Tarte tatin createdBy Delphine Roux.',
    },
    {
      name: 'reviews',
      from: 'Review',
      to: 'Recipe',
      definition: 'The recipe this review is about.',
      comment: 'From the review outward, so a recipe need not know how many it has.',
      example: 'A four-star review reviews Tarte tatin.',
    },
    {
      name: 'writtenBy',
      from: 'Review',
      to: 'Cook',
      definition: 'The cook who wrote this review.',
      comment: 'The same Cook class as authorship, because the same people do both.',
      example: 'The four-star review is writtenBy Delphine Roux.',
    },
    // Drawn twice: a restriction rules out both whole ingredients and whole recipes.
    {
      name: 'incompatibleWith',
      from: 'DietaryRestriction',
      to: 'Ingredient',
      definition: 'Something this restriction rules out.',
      comment:
        'Drawn from a restriction to both an ingredient and a whole recipe, so one property covers both. That is why it has no single rdfs:range in the export.',
      example: 'Gluten-free is incompatibleWith Plain flour.',
    },
    { name: 'incompatibleWith', from: 'DietaryRestriction', to: 'Recipe' },
    {
      name: 'includesRecipe',
      from: 'MealPlan',
      to: 'Recipe',
      definition: 'A recipe chosen for this plan.',
      comment: 'Which day it falls on is not captured, which a working meal planner would need.',
      example: 'Weeknight dinners includesRecipe Tarte tatin.',
    },
    {
      name: 'variantOf',
      from: 'Recipe',
      to: 'Recipe',
      definition: 'A recipe this one is an adaptation of.',
      comment:
        'From a class to itself, and one-way: the variant knows its original, and the original is unchanged by it.',
      example: 'A pear tarte tatin is a variantOf the apple one.',
    },
  ],

  spareProperties: [
    {
      name: 'substituteFor',
      definition: 'An ingredient that can stand in for another.',
      comment:
        'Declared but never drawn, so it sits unused in the property list — which is the quickest way to see what an unused property looks like.',
      example: 'Margarine is a substituteFor butter.',
    },
  ],
});
