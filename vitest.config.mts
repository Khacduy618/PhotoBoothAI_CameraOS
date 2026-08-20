import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: false,
        passWithNoTests: true,
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/*.electron.spec.ts",
            "**/apps/desktop/tests/e2e/**",
        ],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
});
