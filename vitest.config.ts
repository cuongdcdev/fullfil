import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts", "apps/web/**/*.test.ts", "apps/shopper/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
