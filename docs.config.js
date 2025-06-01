const path = require("path");
const reactDocgen = require("react-docgen");

module.exports = {
  typescript: {
    parser: "react-docgen-typescript",
    tsconfig: path.resolve(__dirname, "tsconfig.json"),
    includes: ["src/**/*.{ts,tsx}"],
    parserOptions: {
      propFilter: (prop) => {
        if (!prop.parent) return true;
        const filename = prop.parent.fileName;
        return (
          filename.includes("node_modules/@dhis2/ui") ||
          !filename.includes("node_modules")
        );
      },
    },
  },
  javascript: {
    parser: "react-docgen",
    includes: ["src/**/*.{js,jsx}"],
    resolver: reactDocgen.resolver.findAllExportedComponentDefinitions,
  },
  output: "docs/components",
  ignore: [
    "**/*.test.*",
    "**/__mocks__/**",
    "**/__snapshots__/**",
    "**/*.stories.*",
  ],
};
