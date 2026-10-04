import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Slow suite: deep perft and full AI matches. Run on demand with `npm run test:slow`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    passWithNoTests: true,
    environment: "node",
    include: ["src/**/*.slow.test.ts", "test/**/*.slow.test.ts"],
    testTimeout: 10 * 60 * 1000,
  },
});
