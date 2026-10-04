import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Folder boundaries (docs/SPEC.md §3.2). Each folder gets its own full rule config,
// because flat config replaces (not merges) options of the same rule.
const UI_LIBS = ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*"];
const PARENT_RELATIVE = {
  group: ["../*"],
  message: "Use the @/ alias for imports outside the current folder.",
};

function boundary(files, { forbidden = [], typeOnly = [], allowParentRelative = false }) {
  const patterns = [];
  if (forbidden.length > 0) {
    patterns.push({ group: forbidden, message: "Import not allowed by folder boundaries (SPEC §3.2)." });
  }
  if (!allowParentRelative) patterns.push(PARENT_RELATIVE);
  const paths = typeOnly.map((name) => ({
    name,
    allowTypeImports: true,
    message: "Only type imports are allowed here (SPEC §3.2).",
  }));
  return {
    files,
    rules: { "@typescript-eslint/no-restricted-imports": ["error", { paths, patterns }] },
  };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  boundary(["src/engine/core/**"], {
    forbidden: [...UI_LIBS, "@/*", "!@/engine/core", "!@/engine/core/*"],
  }),
  boundary(["src/engine/*.ts"], {
    forbidden: [...UI_LIBS, "@/ai", "@/ai/*", "@/components/*", "@/hooks/*", "@/lib/*", "@/app/*"],
  }),
  boundary(["src/ai/**"], {
    forbidden: [...UI_LIBS, "@/components/*", "@/hooks/*", "@/lib/*", "@/app/*"],
  }),
  boundary(["src/components/**"], {
    forbidden: ["@/engine/*", "@/ai", "@/ai/*", "@/hooks/*", "@/lib/*", "@/app/*"],
    typeOnly: ["@/engine"],
    allowParentRelative: false,
  }),
  boundary(["src/hooks/**"], {
    forbidden: ["@/engine/*", "!@/engine/types", "@/ai/*", "!@/ai/protocol", "@/components/*", "@/app/*"],
    typeOnly: ["@/ai/protocol"],
  }),
  boundary(["src/lib/**"], {
    forbidden: ["@/engine/*", "!@/engine/types", "@/ai", "@/ai/*", "@/components/*", "@/hooks/*", "@/app/*"],
  }),
  boundary(["src/app/**"], {
    forbidden: ["@/engine/*", "!@/engine/types", "@/ai", "@/ai/*"],
  }),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
