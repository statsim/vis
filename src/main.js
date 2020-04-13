// const Dygraph = require('dygraphs')
const TSNE = require('tsne').tSNE
const Matrix = require('ml-matrix').Matrix
const PCA = require('ml-pca').PCA
const UMAP = require('umap-js').UMAP
const parse = require('csv-parse/lib/sync')

const Plotly = require('./plotly-custom.js')

function unpack (rows, key) {
  return rows.map(row => row[key])
}

class Vis {
  constructor () {
    this.outputs = document.getElementById('outputs')
    this.divPlot = document.createElement('div')
    this.divPlot.style.height = '600px'
    this.divPlot.style.width = '100%'
    this.divPlot.style.maxWidth = '600px'
    this.outputs.appendChild(this.divPlot)

    this.file = ''
    this.records = []
    this.keys = []
  }
  run (params) {
    if (params.file !== this.file) {
      // New file, return columns
      this.file = params.file
      this.records = parse(params.file, {
        columns: true,
        skip_empty_lines: true
      })
      this.keys = Object.keys(this.records[0]).filter(key => key.length)
      return {
        'column': {
          'options': ['None'].concat(this.keys)
        }
      }
    } else {
      // File is not new, do dimensionality reduction
      if (!this.outputs.innerText.length) {
        this.outputs.appendChild(this.divPlot)
      }

      const len = this.records.length || 1
      const nDims = parseInt(params.dimensions)
      const features = this.keys.filter(k => (k !== params.column) && k.length)
      const Xraw = new Matrix(this.records.map(row => features.map(f => row[f])))
      const featuresFiltered = []

      // Remove columns with many NaNs
      const cols = []
      for (let i = 0; i < Xraw.columns; i++) {
        let col = Xraw.getColumn(i)
        let na = col.reduce((a, x) => a + isNaN(x), 0)
        console.log('[Vis] Feature:', features[i], na, 100 * na / len + '%')
        if (na < len / 10) {
          cols.push(i)
          featuresFiltered.push(features[i])
        }
      }
      let X = Xraw.subMatrixColumn(cols)

      // Transform: Scale
      if (params.transform) {
        if (params.transform === 'Scale') {
          console.log('[Vis] Scale input matrix X')
          X = X.scaleColumns()
        } else if (params.transform === 'Log') {
          console.log('[Vis] Log-transform matrix X')
          X = X.add(1).log()
        }
      }

      X = X.to2DArray()

      // Remove rows with NaN
      const rows = []
      for (let i = 0; i < len; i++) {
        let row = X[i]
        let na = row.reduce((a, x) => a + isNaN(x), 0)
        if (na === 0) {
          rows.push(i)
        }
      }
      X = X.filter((_, i) => rows.includes(i))

      console.log('[Vis] Target variable:', params.column ? params.column : 'None')
      console.log('[Vis] Keys:', this.keys)
      console.log('[Vis] Features:', features)
      console.log('[Vis] Features (filtered):', featuresFiltered)
      console.log('[Vis] Xraw:', Xraw)
      console.log('[Vis] X:', X)
      console.log('[Vis] Embedding method:', params.method)

      let Y
      if (params.method === 'PCA') {
        console.log('[Vis] Fitting PCA')
        const pca = new PCA(X)
        Y = pca.predict(X, {'nComponents': nDims}).to2DArray()
      } else if (params.method === 'UMAP') {
        console.log('[Vis] Fitting UMAP')
        const umap = new UMAP({'nComponents': nDims, 'nEpochs': params.steps})
        umap.initializeFit(X)
        for (let i = 0; i < params.steps; i++) {
          umap.step()
        }
        Y = umap.getEmbedding()
      } else {
        const tsne = new TSNE({'epsilon': 10, 'dim': nDims})
        tsne.initDataRaw(X)
        const steps = params.steps || 100
        for (let k = 0; k <= steps; k++) {
          console.log('[tSne] Step:', k)
          tsne.step()
        }
        Y = tsne.getSolution()
      }

      console.log('[Vis] Y:', Y)

      /*
      let Yfin
      if (params.column && params.column.length) {
        const g = this.records.map(row => row[params.column])
        const groups = [...new Set(g)]
        console.log('[Vis] Groups:', groups)
        Yfin = Y.map((y, i) => [y[0]].concat(groups.map(group => g[i] === group ? y[1] : null)))
      } else {
        Yfin = Y
      }
      console.log('[Vis] Yfin:', Yfin)
      */

      /*
      const graphPlot = new Dygraph(
        this.divPlot,
        Yfin.sort((a, b) => a[0] > b[0]),
        {
          'panEdgeFraction': 0,
          'interactionModel': {},
          'strokeWidth': 0.0,
          'drawPoints': true,
          'pointSize': 2,
          'highlightCircleSize': 6,
          'colors': ['#d81e37', '#01a84f', '#505bb7', '#ff05a3', '#ffd402']
        }
      )
      */

      let target
      let colorscale
      let g
      if (params.column && params.column.length && (params.column !== 'None')) {
        g = this.records.map(row => row[params.column]).filter((_, i) => rows.includes(i))
        const groups = [...new Set(g)].sort((a, b) => a > b)
        console.log('[Vis] Groups:', groups, g.length, Y.length)
        target = g.map((group, i) => groups.findIndex(el => el === group) / (groups.length > 2 ? groups.length - 1 : 1))
        colorscale = [
          [0.0, '#d90368'],
          [0.25, '#ffd400'],
          [0.5, '#4ecc35'],
          [0.75, '#119ddd'],
          [1, '#2f2fb7']
        ]
      } else {
        target = Array(Y.length).fill(0)
        colorscale = [
          [0, '#26C9BD'],
          [1, '#26C9BD']
        ]
      }
      console.log('[Vis] Target encoded:', target)

      if (nDims === 2) {
        let trace = {
          x: unpack(Y, 0),
          y: unpack(Y, 1),
          mode: 'markers',
          marker: {
            size: 6,
            opacity: 0.7,
            color: target,
            colorscale: colorscale
          },
          text: g && g.length ? g.map(el => '<b>' + el + '</b>') : null,
          type: 'scatter'
        }
        let data = [ trace ]
        let layout = {
          title: params.method,
          hovermode: 'closest',
          margin: {
            l: 0,
            r: 0,
            b: 0,
            t: 0
          }
        }
        Plotly.newPlot(this.divPlot, data, layout, {responsive: true})
      } else {
        let trace = {
          x: unpack(Y, 0),
          y: unpack(Y, 1),
          z: unpack(Y, 2),
          mode: 'markers',
          marker: {
            size: 2.5,
            opacity: 0.7,
            color: target,
            colorscale: colorscale
          },
          text: g && g.length ? g.map(el => '<b>' + el + '</b>') : null,
          type: 'scatter3d'
        }
        let data = [trace]
        let layout = {
          title: params.method,
          hovermode: 'closest',
          margin: {
            l: 0,
            r: 0,
            b: 0,
            t: 0
          }
        }
        Plotly.newPlot(this.divPlot, data, layout, {responsive: true})
      }
      // console.log(Y, typeof graphPlot)
    }
  }
}

module.exports = Vis
