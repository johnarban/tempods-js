module.exports = {
  root: true,
  // This file, and the other build configs, are CommonJS and run in node.
  // Without this, eslint lints them as browser scripts and `module` is undefined.
  env: {
    node: true,
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    extraFileExtensions: ['.vue']
  },
  plugins: [
    '@typescript-eslint',
    "vuejs-accessibility",
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/essential',
    '@vue/typescript/recommended',
    "plugin:vuejs-accessibility/recommended",
  ],
  rules: {
    "indent": ["error", 2],
    "@typescript-eslint/naming-convention": [
      "error", {
        selector: ["variable", "memberLike", "function"],
        format: ["camelCase"],
        leadingUnderscore: "allow"
      },
      {
        selector: ["variable"],
        modifiers: ["global", "const"],
        format: ["camelCase", "UPPER_CASE"],
        leadingUnderscore: "allow"
      },
      {
        selector: "typeLike",
        format: ["PascalCase"],
        leadingUnderscore: "allow"
      },
      {
        selector: [
          "classProperty",
          "objectLiteralProperty",
          "typeProperty",
          "classMethod",
          "objectLiteralMethod",
          "typeMethod",
          "accessor",
          "enumMember"
        ],
        format: null,
        modifiers: ["requiresQuotes"]
      }
    ],
    "@typescript-eslint/no-unused-vars": [
      "error", {
        "args": "all",
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/semi": "error",
    "vue/multi-word-component-names": "off",
    "vue/no-v-model-argument": "off",
    // The rule's default is `every: ["nesting", "id"]`, which demands that a
    // label BOTH wrap its control and carry a `for`. Either one on its own is a
    // valid association, and this codebase uses explicit for/id in several
    // places (RegionEditor, UserDatasetEditor, TimeSlider, YearsPicker) and
    // nesting in others (DaysPicker). `some` accepts either and still catches
    // a <label> that is attached to nothing at all.
    "vuejs-accessibility/label-has-for": ["error", {
      required: { some: ["nesting", "id"] },
    }],
  }
};
