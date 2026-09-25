module.exports = [
  {
    test: /native_modules[/\\].+\.node$/,
    use: "node-loader",
  },
  {
    test: /\.js?$/,
    use: {
      loader: "babel-loader",
      options: {
        exclude: /node_modules/,
        presets: ["@babel/preset-react"],
      },
    },
  },
  {
    test: /\.m?js$/,
    include: /node_modules[\\/](@minoru|framer-motion|motion|dnd-multi-backend)/,
    resolve: {
      fullySpecified: false,
    },
  },
];
