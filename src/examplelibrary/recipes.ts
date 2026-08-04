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
  ],

  classes: [
    {
      name: 'Recipe',
      at: [40, 40],
      definition: 'Instructions for making one dish.',
      labels: [
        ['Recipe', 'en'],
        ['Recept', 'nl'],
        ['Rezept', 'de'],
      ],
      attributes: [
        ['recipeTitle', 'string'],
        ['servings', 'integer'],
        ['prepMinutes', 'integer'],
        ['cookMinutes', 'integer'],
        ['difficulty', 'string'],
        ['isVegetarian', 'boolean'],
        ['isVegan', 'boolean'],
        ['publishedOn', 'date'],
        ['sourceUrl', 'anyURI'],
      ],
    },
    {
      name: 'RecipeIngredient',
      at: [400, 40],
      definition:
        'One ingredient as used in one recipe, with its amount. The quantity belongs here because it belongs to neither the recipe nor the ingredient alone.',
      attributes: [
        ['quantity', 'decimal'],
        ['unit', 'string'],
        ['preparationNote', 'string'],
        ['isOptional', 'boolean'],
      ],
    },
    {
      name: 'Ingredient',
      at: [760, 40],
      definition: 'A foodstuff, independent of any recipe.',
      labels: [
        ['Ingredient', 'en'],
        ['Ingrediënt', 'nl'],
      ],
      attributes: [
        ['ingredientName', 'string'],
        ['caloriesPer100g', 'integer'],
        ['isAllergen', 'boolean'],
        ['storageAdvice', 'string'],
      ],
    },
    {
      name: 'IngredientCategory',
      at: [1100, 40],
      definition: 'A grouping such as dairy, pulses or spices.',
      attributes: [
        ['categoryName', 'string'],
        ['isPerishable', 'boolean'],
      ],
    },
    {
      name: 'Step',
      at: [40, 380],
      definition: 'One instruction in a method.',
      attributes: [
        ['stepNumber', 'integer'],
        ['instruction', 'string'],
        ['durationMinutes', 'integer'],
        ['temperatureCelsius', 'integer'],
      ],
    },
    {
      name: 'Equipment',
      at: [400, 380],
      definition: 'A tool or appliance a step calls for.',
      attributes: [
        ['equipmentName', 'string'],
        ['isEssential', 'boolean'],
      ],
    },
    {
      name: 'Cuisine',
      at: [760, 380],
      definition: 'A regional cooking tradition.',
      attributes: [
        ['cuisineName', 'string'],
        ['region', 'string'],
      ],
    },
    {
      name: 'Course',
      at: [1100, 380],
      definition: 'Where a dish falls in a meal: starter, main, dessert.',
      attributes: [
        ['courseName', 'string'],
        ['servingOrder', 'integer'],
      ],
    },
    {
      name: 'Cook',
      at: [40, 700],
      definition: 'Someone who writes or follows recipes.',
      attributes: [
        ['cookName', 'string'],
        ['skillLevel', 'string'],
        ['joinedOn', 'date'],
      ],
    },
    {
      name: 'ProfessionalChef',
      parent: 'Cook',
      at: [40, 1000],
      definition: 'A cook who does it for a living.',
      attributes: [
        ['restaurantName', 'string'],
        ['michelinStars', 'integer'],
      ],
    },
    {
      name: 'Review',
      at: [400, 700],
      definition: 'What someone thought of a recipe after cooking it.',
      attributes: [
        ['rating', 'integer'],
        ['comment', 'string'],
        ['reviewedOn', 'date'],
        ['wouldCookAgain', 'boolean'],
      ],
    },
    {
      name: 'DietaryRestriction',
      at: [760, 700],
      definition: 'Something a diner cannot or will not eat.',
      attributes: [
        ['restrictionName', 'string'],
        ['isMedical', 'boolean'],
      ],
    },
    {
      name: 'MealPlan',
      at: [1100, 700],
      definition: 'Recipes chosen for a period.',
      attributes: [
        ['planName', 'string'],
        ['startsOn', 'date'],
        ['dayCount', 'integer'],
      ],
    },
  ],

  relations: [
    {
      name: 'usesIngredient',
      from: 'Recipe',
      to: 'RecipeIngredient',
      definition: 'An ingredient line in this recipe.',
    },
    { name: 'refersTo', from: 'RecipeIngredient', to: 'Ingredient' },
    { name: 'inCategory', from: 'Ingredient', to: 'IngredientCategory' },
    { name: 'hasStep', from: 'Recipe', to: 'Step' },
    { name: 'requiresEquipment', from: 'Step', to: 'Equipment' },
    { name: 'fromCuisine', from: 'Recipe', to: 'Cuisine' },
    { name: 'servedAs', from: 'Recipe', to: 'Course' },
    { name: 'createdBy', from: 'Recipe', to: 'Cook' },
    { name: 'reviews', from: 'Review', to: 'Recipe' },
    { name: 'writtenBy', from: 'Review', to: 'Cook' },
    // Drawn twice: a restriction rules out both whole ingredients and whole recipes.
    {
      name: 'incompatibleWith',
      from: 'DietaryRestriction',
      to: 'Ingredient',
      definition: 'Something this restriction rules out.',
    },
    { name: 'incompatibleWith', from: 'DietaryRestriction', to: 'Recipe' },
    { name: 'includesRecipe', from: 'MealPlan', to: 'Recipe' },
    { name: 'variantOf', from: 'Recipe', to: 'Recipe' },
  ],

  spareProperties: [['substituteFor', 'An ingredient that can stand in for another.']],
});
