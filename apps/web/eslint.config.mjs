import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["lib/admin/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/admin", "**/lib/supabase/admin"],
              message:
                "The staff console must not use the service-role client. Use the visitor's own session and the admin_* functions.",
            },
            {
              group: [
                "@/lib/storage*",
                "@/lib/publish*",
                "@/lib/sites*",
                "@/lib/backup*",
                "@/lib/contact*",
                "@/lib/ai/*",
              ],
              message:
                "The staff console must not read or change customer content. See docs/admin.md.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
