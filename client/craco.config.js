const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add fallbacks for Node.js modules
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "path": require.resolve("path-browserify"),
        "zlib": require.resolve("browserify-zlib"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("stream-http"),
        "vm": require.resolve("vm-browserify"),
        "crypto": false,
        "stream": false,
        "util": false,
        "buffer": require.resolve("buffer"),
        "assert": false,
        "url": false,
        "querystring": false,
        "fs": false,
        "net": false,
        "tls": false,
        "child_process": false,
        "async_hooks": false
      };

      // Add plugins to provide global variables
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer']
        })
      );

      // Handle the module type issues with axios and other ES modules
      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      });

      // Ignore specific warnings about Node.js modules
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /Critical dependency: the request of a dependency is an expression/
      ];

      return webpackConfig;
    }
  }
};
