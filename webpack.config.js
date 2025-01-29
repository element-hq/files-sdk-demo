/*
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const path = require('path');
const { merge } = require('webpack-merge');
const parts = require('./webpack.parts');
const { mode, analyze } = require('webpack-nano/argv');

const common = merge([
  { output: { path: path.resolve(process.cwd(), 'dist') } },
  parts.env(),
  parts.page({ title: 'Files SDK Demo' }),
  parts.svelte(mode),
  parts.extractCSS(),
  parts.cleanDist(),
  parts.useWebpackBar(),
  parts.nodePolyfills(),
  parts.olm(),
  parts.public(),
  parts.log4js(),
]);

const development = merge([
  {
    entry: {
      logging: ['./src/logging.ts'],
      main: { import: ['./src/main.ts', 'webpack-plugin-serve/client'], dependOn: 'logging' },
    },
  },
  { target: 'web' },
  parts.generateSourceMaps({ type: 'eval-source-map' }),
  parts.esbuild(),
  parts.devServer(),
]);

const production = merge(
  [
    {
      entry: {
        logging: ['./src/logging.ts'],
        main: { import: ['./src/main.ts'], dependOn: 'logging' },
      },
    },
    parts.typescript(),
    parts.optimize(),
    analyze && parts.analyze()
  ].filter(Boolean),
);

const getConfig = mode => {
  switch (mode) {
    case 'production':
      return merge(common, production, { mode });
    case 'development':
      return merge(common, development, { mode });
    default:
      throw new Error(`Unknown mode, ${mode}`);
  };
};

module.exports = getConfig(mode);
