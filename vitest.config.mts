import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: false,
        passWithNoTests: true,
        testTimeout: 15000,
        hookTimeout: 15000,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: process.platform === "win32",
            },
        },
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
            "@momentai/shared-types": path.resolve(__dirname, "./packages/shared-types/src"),
            "@momentai/session-engine": path.resolve(__dirname, "./packages/session-engine/src"),
            "@momentai/shot-engine": path.resolve(__dirname, "./packages/shot-engine/src"),
            "@momentai/camera-contract": path.resolve(__dirname, "./packages/camera-contract/src"),
            "@momentai/printer-contract": path.resolve(__dirname, "./packages/printer-contract/src"),
            "@momentai/storage-contract": path.resolve(__dirname, "./packages/storage-contract/src"),
            "@momentai/admin-contract": path.resolve(__dirname, "./packages/admin-contract/src"),
            "@momentai/test-fixtures": path.resolve(__dirname, "./packages/test-fixtures/src"),
        },
    },
});
