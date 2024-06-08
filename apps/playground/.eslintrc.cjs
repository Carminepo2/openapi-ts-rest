module.exports = {
  env: { browser: true, es2020: true },
  extends: ["../../.eslintrc.cjs", "plugin:react-hooks/recommended"],
  ignorePatterns: ["vite-env.d.ts", "tailwind.config.js", "postcss.config.js"],
};
