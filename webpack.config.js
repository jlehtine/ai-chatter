const path = require("path");
const GasPlugin = require("gas-webpack-plugin");

module.exports = {
  mode: "production",
  entry: "./src/ai-chatter.ts",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts"],
  },
  output: {
    filename: "ai-chatter.js",
    path: path.resolve(__dirname, "appsscript"),
  },
  optimization: {
    usedExports: "global",
  },
  plugins: [new GasPlugin()],
};
