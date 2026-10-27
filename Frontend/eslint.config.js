import js from "@eslint/js";
import ts from "typescript-eslint";

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    ignores: [
      "dist/**",
      ".output/**",
      ".tanstack/**",
      "node_modules/**",
      "routeTree.gen.ts",
      "frontend/**",
      "src/routeTree.gen.ts",
      "serve.js",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-empty": "off",
      "no-undef": "off",
    },
  },
];
