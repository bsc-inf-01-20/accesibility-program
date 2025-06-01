// styleguide.config.js
const path = require('path');
const docgen = require('react-docgen-typescript');
styles: require('./styleguide.styles.js'),


module.exports = {
  title: 'Accessibility Program Docs',

  // Only include real component and hook files
  components: [
    'src/components/**/*.jsx',
    'src/pages/**/*.jsx',
    'src/Hooks/**/*.js',
  ],

  // Exclude tests and unwanted files
  ignore: ['**/*.test.js', '**/*.test.jsx'],

  // Parse props (optional if you only use plain JS/JSX)
  propsParser: docgen.withCustomConfig('./tsconfig.json').parse,

  // Webpack config for Styleguidist
  webpackConfig: {
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: ['babel-loader'],
        },
        {
          test: /\.css$/, // Add CSS support
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|woff2?|ttf|eot)$/, // Asset support
          loader: 'file-loader',
        },
      ],
    },
  },
};
