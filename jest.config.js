export default {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/unit"],
  testMatch: ["**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: {
    "^.+\\.ts$": ["@swc/jest", { jsc: { target: "es2024", parser: { syntax: "typescript" } } }],
  },
};
