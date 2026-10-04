import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

// Fast suite: run before every PR. Slow tests (*.slow.test.ts) live in vitest.slow.config.ts.
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/engine/**/*.test.ts", "src/ai/**/*.test.ts", "test/**/*.test.ts"],
          exclude: ["**/*.slow.test.ts", "**/node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "src/components/**/*.test.{ts,tsx}",
            "src/hooks/**/*.test.{ts,tsx}",
            "src/lib/**/*.test.{ts,tsx}",
            "src/app/**/*.test.{ts,tsx}",
          ],
          exclude: ["**/*.slow.test.ts", "**/node_modules/**"],
          setupFiles: ["./test/setup-dom.ts"],
        },
      },
    ],
  },
});
