module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./src",
            "@app": "./src/app",
            "@components": "./src/components",
            "@hooks": "./src/hooks",
            "@constants": "./src/constants",
            "@lib": "./src/lib",
            "@screens": "./src/screens",
            "@services": "./src/services",
            "@types": "./src/types",
          },
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      ],
    ],
  };
};
