/*
Copyright 2021-2022 New Vector Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const path = require('path');
const { merge } = require('webpack-merge');
const parts = require('./webpack.parts');
const { mode, analyze } = require('webpack-nano/argv');

const common = merge([
  { output: { path: path.resolve(process.cwd(), 'dist') } },
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
  { entry: ['./src/main.ts', 'webpack-plugin-serve/client'] },
  { target: 'web' },
  parts.generateSourceMaps({ type: 'eval-source-map' }),
  parts.esbuild(),
  parts.devServer(),
]);

const production = merge(
  [
    { entry: ['./src/main.ts'] },
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
