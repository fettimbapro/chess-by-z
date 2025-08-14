export default [
  {
    ignores: ["**/vendor/**"],
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { ecmaVersion: 2021, sourceType: "module" },
    rules: {
      semi: "error",
      "no-unused-vars": "warn"
    }
  }
];
