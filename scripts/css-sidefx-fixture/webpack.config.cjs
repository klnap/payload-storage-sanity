const path = require('node:path')

module.exports = {
  mode: 'production',
  entry: './entry.js',
  output: { path: path.join(__dirname, 'out'), filename: 'bundle.js', clean: true },
  module: { rules: [{ test: /\.css$/, use: ['css-loader'] }] },
  optimization: { usedExports: true, sideEffects: true },
}
