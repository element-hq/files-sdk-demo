const path = require('path');
const preprocess = require('svelte-preprocess');
const { ESBuildPlugin } = require('esbuild-loader');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { WebpackPluginServe } = require('webpack-plugin-serve');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const WebpackBar = require('webpackbar');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const { MiniHtmlWebpackPlugin } = require('mini-html-webpack-plugin');

exports.devServer = () => ({
  watch: true,
  plugins: [
    new WebpackPluginServe({
      port: 5001,
      static: path.resolve(process.cwd(), 'dist'),
      historyFallback: true
    })
  ]
})

exports.page = ({ title }) => ({
  plugins: [new MiniHtmlWebpackPlugin({
    publicPath: '/',
    context: {
      title,
      head: `
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="icon" type="image/png" href="/favicon.png">
        <link rel="stylesheet" href="/global.css">
        <script src="/olm/olm.js"></script>`,
    },
  })]
})

exports.olm = () => ({
  plugins: [
    new CopyPlugin({
      patterns: [
				{
          from: './olm*',
          to: 'olm/',
          context: './node_modules/@matrix-org/olm/',
        },
      ],
    }),
  ],
});

exports.public = () => ({
  plugins: [
    new CopyPlugin({
      patterns: [
				{
          from: '**',
          to: './',
          context: './public/',
        },
      ],
    }),
  ],
});

exports.generateSourceMaps = ({ type }) => ({ devtool: type })

exports.loadImages = ({ limit } = {}) => ({
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif|webp)$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: limit } }
      },
      { test: /\.svg$/, type: 'asset' },
    ]
  }
})

exports.optimize = () => ({
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all'
    },
    runtimeChunk: { name: 'runtime' },
    minimizer: [`...`, new CssMinimizerPlugin()]
  }
})

exports.analyze = () => ({
  plugins: [
    new BundleAnalyzerPlugin({
      generateStatsFile: true
    })
  ]
})

exports.typescript = () => ({
  module: { rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }] }
})

exports.extractCSS = ({ options = {}, loaders = [] } = {}) => {
  return {
    module: {
      rules: [
        {
          test: /\.(p?css)$/,
          use: [{ loader: MiniCssExtractPlugin.loader, options }, 'css-loader'].concat(
            loaders
          ),
          sideEffects: true
        }
      ]
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css'
      })
    ]
  }
}

exports.svelte = mode => {
  const prod = mode === 'production'

  return {
    resolve: {
      alias: {
        svelte: path.dirname(require.resolve('svelte/package.json'))
      },
      extensions: ['.mjs', '.js', '.svelte', '.ts'],
      mainFields: ['svelte', 'browser', 'module', 'main']
    },
    module: {
      rules: [
        {
          test: /\.svelte$/,
          use: {
            loader: 'svelte-loader',
            options: {
              compilerOptions: {
                dev: !prod
              },
              emitCss: prod,
              hotReload: !prod,
              preprocess: preprocess({
                typescript: true
              })
            }
          }
        },
        {
          test: /node_modules\/svelte\/.*\.mjs$/,
          resolve: {
            fullySpecified: false
          }
        }
      ]
    }
  }
}

exports.esbuild = () => {
  return {
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: 'esbuild-loader',
          options: {
            target: 'es2015'
          }
        },
        {
          test: /\.ts$/,
          loader: 'esbuild-loader',
          options: {
            loader: 'ts',
            target: 'es2015'
          }
        }
      ]
    },
    plugins: [new ESBuildPlugin()]
  }
}

exports.cleanDist = () => ({
  plugins: [new CleanWebpackPlugin()]
})

exports.useWebpackBar = () => ({
  plugins: [new WebpackBar()]
})

exports.nodePolyfills = () => ({
	plugins: [new NodePolyfillPlugin()],
  resolve: {
    fallback: {
      net: false,
      tls: false,
      fs: false,
    }
  },
  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
});
