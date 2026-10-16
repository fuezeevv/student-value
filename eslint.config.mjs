import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";
const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});
export default [
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      "node_modules/**",
      ".test-work/**",
      "docs/**",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "@next/next/no-img-element": "off",
      "no-unreachable": "error",
      "no-constant-binary-expression": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: "Render untrusted text with React nodes, never unsafe HTML.",
        },
      ],
    },
  },
];
