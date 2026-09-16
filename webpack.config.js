// Configuración de Webpack para análisis de bundle
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    // Solo activar en modo desarrollo para análisis
    process.env.ANALYZE === 'true' && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-analysis.html'
    })
  ].filter(Boolean)
};