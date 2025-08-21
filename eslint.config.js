export default [
  {
    ignores: [
      "**/vendor/**",
      "chess-website-uml/public/src/engine/OpeningBook.js",
      "chess-website-uml/public/src/engine/openingBookData.js",
    ],
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module" },
    rules: {
      semi: "error",
      "no-unused-vars": "warn",
    },
  },
];
