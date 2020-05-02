var Plotly = require('plotly.js/lib/core')

Plotly.register([
  require('plotly.js/lib/bar'),
  require('plotly.js/lib/heatmap'),
  require('plotly.js/lib/parcoords'),
  require('plotly.js/lib/scatter'),
  require('plotly.js/lib/scatter3d'),
  require('plotly.js/lib/splom')
])

module.exports = Plotly
