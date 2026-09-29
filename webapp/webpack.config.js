const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: ['./src/index.tsx'],
  resolve: {
    modules: ['src', 'node_modules'],
    extensions: ['*', '.js', '.jsx', '.ts', '.tsx'],
    alias: {
      'hwp.js': path.resolve(__dirname, 'src/vendor/hwp.js'),
    },
    fallback: {
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser'),
      fs: false,
      stream: false,
      path: false,
      crypto: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              ['@babel/preset-react', { runtime: 'classic' }],
              '@babel/preset-typescript',
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    redux: 'Redux',
    'react-redux': 'ReactRedux',
    'prop-types': 'PropTypes',
  },
  output: {
    devtoolNamespace: 'mattermost-hwp-view',
    path: path.join(__dirname, '/dist'),
    publicPath: '/',
    filename: 'main.js',
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ],
};
