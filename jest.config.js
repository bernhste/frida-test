export default {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/unit"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: {
    "^.+\\.[tj]s$": ["@swc/jest", { module: { type: "commonjs" }, jsc: { target: "es2024", parser: { syntax: "typescript" } } }],
  },
  transformIgnorePatterns: ["/node_modules/(?!(chalk)/)"],
};
