var Plotly = require('plotly.js/lib/core')

Plotly.register([
  require('plotly.js/lib/scatter'),
  require('plotly.js/lib/scatter3d')
])

module.exports = Plotly
