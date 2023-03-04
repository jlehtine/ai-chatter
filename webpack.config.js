const path = require("path");
const GasPlugin = require("gas-webpack-plugin");

module.exports = {
    mode: "production",
    entry: "./src/AIChatter.ts",
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
        filename: "AIChatter.js",
        path: path.resolve(__dirname, "appsscript"),
    },
    optimization: {
        usedExports: "global",
    },
    plugins: [new GasPlugin()],
};
