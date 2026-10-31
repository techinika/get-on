import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/coverage/**",
    "apps/**",
  ]),
  ...tseslint.configs.recommended,
  {
    files: ["packages/**/*.ts", "packages/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "no-console": "warn",
    },
  },
  // Type-aware rules for the email, notification and auth code paths.
  // These catch floating promises and misused promises (for example an awaited
  // send inside a catch that is never itself awaited) so nothing fails silently.
  ...tseslint.configs.recommendedTypeChecked.flatMap((config) =>
    Array.isArray(config) ? config : [config],
  ).map((config) => ({
    ...config,
    files: ["packages/email/**/*.ts", "apps/web/lib/email/**/*.ts", "apps/web/lib/auth/**/*.ts", "apps/web/app/api/auth/**/*.ts"],
    rules: {
      ...config.rules,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        project: ["apps/web/tsconfig.json", "packages/email/tsconfig.json"],
      },
    },
  })),
]);
