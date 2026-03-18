const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

module.exports = [
    ...compat.config({
        env: {
            "googleappsscript/googleappsscript": true,
        },
        extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
        parser: "@typescript-eslint/parser",
        parserOptions: {
            ecmaVersion: "latest",
        },
        plugins: ["@typescript-eslint", "googleappsscript"],
        rules: {},
    }),
];
