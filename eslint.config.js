export default [
  {
    ignores: ["**/vendor/**", "chess-website-uml/public/src/engine/OpeningBook.js", "chess-website-uml/public/src/engine/openingBook.js"],
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module" },
    rules: {
      semi: "error",
      "no-unused-vars": "warn"
    }
  }
];
