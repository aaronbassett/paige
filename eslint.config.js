// @ts-check

import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ---------------------------------------------------------------
  // Global ignores (replaces .eslintignore)
  // ---------------------------------------------------------------
  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      // Ignore all .js files EXCEPT config files at the project root
      "**/*.js",
      "!*.config.js",
      "!.*.js",
    ],
  },

  // ---------------------------------------------------------------
  // Base: ESLint recommended rules for all files
  // ---------------------------------------------------------------
  js.configs.recommended,

  // ---------------------------------------------------------------
  // TypeScript: type-aware linting with recommended-type-checked
  // Spread the flat config array which includes parser + plugin setup
  // ---------------------------------------------------------------
  ...tsPlugin.configs["flat/recommended-type-checked"],

  // ---------------------------------------------------------------
  // TypeScript source files: parser options for type-aware rules
  // ---------------------------------------------------------------
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // -----------------------------------------------------------
      // Type safety (constitution: no `any` unless justified)
      // -----------------------------------------------------------
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",

      // -----------------------------------------------------------
      // Unused variables (allow underscore-prefixed args)
      // -----------------------------------------------------------
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // -----------------------------------------------------------
      // Async / Promise discipline
      // -----------------------------------------------------------
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // -----------------------------------------------------------
      // General code quality
      // -----------------------------------------------------------
      "prefer-const": "error",
      "no-console": "warn",
      "no-duplicate-imports": "error",
      "no-template-curly-in-string": "warn",
      eqeqeq: ["error", "always"],
      "no-throw-literal": "off",
      "@typescript-eslint/only-throw-error": "error",

      // -----------------------------------------------------------
      // Consistency
      // -----------------------------------------------------------
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    },
  },

  // ---------------------------------------------------------------
  // Test files: relax rules that are impractical in tests
  // ---------------------------------------------------------------
  {
    files: ["tests/**/*.ts"],
    rules: {
      // Tests often use unbound methods for mocking
      "@typescript-eslint/unbound-method": "off",
      // Test assertions may use any for flexibility
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      // Console logging in tests is acceptable
      "no-console": "off",
    },
  },

  // ---------------------------------------------------------------
  // Prettier: disable all formatting rules (must be last)
  // ---------------------------------------------------------------
  prettier,
];
