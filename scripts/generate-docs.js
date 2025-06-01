const fs = require('fs');
const path = require('path');
const reactDocgen = require('react-docgen');
const reactDocgenTs = require('react-docgen-typescript');
const config = require('../docs.config');

// Create output directory if needed
fs.mkdirSync(config.output, { recursive: true });

try {
  // TypeScript components
  if (config.typescript) {
    const tsParser = reactDocgenTs.withCustomConfig(config.typescript.tsconfig, config.typescript.parserOptions);
    const tsFiles = config.typescript.includes
      .map((pattern) => require('glob').sync(pattern))
      .flat();
    const tsDocs = tsParser.parse(tsFiles);
    fs.writeFileSync(
      path.join(config.output, 'typescript.json'),
      JSON.stringify(tsDocs, null, 2)
    );
    console.log('✅ TypeScript documentation generated');
  }

  // JavaScript components
  if (config.javascript) {
    const jsFiles = config.javascript.includes
      .map((pattern) => require('glob').sync(pattern))
      .flat();

    const jsDocs = jsFiles.map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      try {
        return {
          file: filePath,
          components: reactDocgen.parse(
            content,
            config.javascript.resolver
          ),
        };
      } catch (err) {
        console.warn(`⚠️ Skipping ${filePath} (not a component):`, err.message);
        return null;
      }
    }).filter(Boolean);

    fs.writeFileSync(
      path.join(config.output, 'javascript.json'),
      JSON.stringify(jsDocs, null, 2)
    );
    console.log('✅ JavaScript documentation generated');
  }

  console.log('🎉 All documentation generated successfully!');
} catch (error) {
  console.error('❌ Documentation generation failed:', error);
  process.exit(1);
}
