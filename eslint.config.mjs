import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      ".next/**",
      ".test-build/**",
      "node_modules/**",
      "webdata/**",
      "scratch/**",
      "public/lists/**",
      "*.tsbuildinfo",
    ],
  },
  ...nextVitals,
];

export default config;
