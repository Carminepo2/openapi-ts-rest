import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config({
  env: { browser: true, es2020: true },
  extends: ["../../.eslint.config.js", "plugin:react-hooks/recommended"],
  plugins: ["react-refresh"],
  rules: {
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
  },
});
