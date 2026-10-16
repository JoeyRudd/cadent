import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      complexity: ["error", 8],
      "max-lines": ["error", 250],
      // Design tokens only: no raw colours or arbitrary Tailwind values in components.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Use a design token (see src/tokens.css), not a raw colour.",
        },
        {
          selector: "Literal[value=/\\w-\\[[^\\]]+\\]/]",
          message: "No arbitrary Tailwind values; add a token instead.",
        },
      ],
    },
  },
);
