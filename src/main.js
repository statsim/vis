const Dygraph = require('dygraphs')
const Plotly = require('plotly.js-dist')
const TSNE = require('tsne').tSNE
const Matrix = require('ml-matrix').Matrix
const PCA = require('ml-pca').PCA
const parse = require('csv-parse/lib/sync')

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
    // const tsne = new TSNE({epsilon: 10})
    if (params.file !== this.file) {
      // New file, return columns
      this.file = params.file
      this.records = parse(params.file, {
        columns: true,
        skip_empty_lines: true
      })
      this.keys = Object.keys(this.records[0])
      return {
        'column': {
          'options': this.keys
        }
      }
    } else {
      if (!this.outputs.innerText.length) {
        this.outputs.appendChild(this.divPlot)
      }
      console.log('[Vis] Group by column:', params.column)
      const Xraw = new Matrix(this.records.map(row => this.keys.map(k => row[k])))
      const cols = []
      const nDims = parseInt(params.dimensions)
      for (let i = 0; i < Xraw.columns; i++) {
        let col = Xraw.getColumn(i)
        let na = col.reduce((a, x) => a + isNaN(x), 0)
        if (na === 0) {
          cols.push(i)
        }
      }
      const X = Xraw.subMatrixColumn(cols)
      console.log('[Vis] X:', X)

      console.log('[Vis] Embedding method:', params.method)
      let Y
      if (params.method === 'PCA') {
        console.log('[Vis] Fitting PCA')
        const pca = new PCA(X)
        Y = pca.predict(X, {'nComponents': nDims}).to2DArray()
      } else {
        const tsne = new TSNE({'epsilon': 10, 'dim': nDims})
        tsne.initDataRaw(X.to2DArray())
        for (let k = 0; k <= 100; k++) {
          console.log(k)
          tsne.step()
        }
        Y = tsne.getSolution()
      }

      console.log('[Vis] Y:', Y)

      let Yfin

      /*
      if (params.column && params.column.length) {
        const g = this.records.map(row => row[params.column])
        const groups = [...new Set(g)]
        console.log('[Vis] Groups:', groups)
        Yfin = Y.map((y, i) => [y[0]].concat(groups.map(group => g[i] === group ? y[1] : null)))
      } else {
        Yfin = Y
      }
      */

      Yfin = Y
      console.log('[Vis] Yfin:', Yfin)

      const g = this.records.map(row => row[params.column])

      if (nDims === 2) {
        var trace = {
          x: unpack(Yfin, 0),
          y: unpack(Yfin, 1),
          mode: 'markers',
          marker: {
            size: 8,
            opacity: 0.8,
            color: g
          },
          type: 'scatter'
        }

        var data = [ trace ]

        var layout = {
          title: 'Data Labels Hover',
          margin: {
            l: 0,
            r: 0,
            b: 0,
            t: 0
          }
        }
        Plotly.newPlot(this.divPlot, data, layout)
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
      } else {
        var trace = {
          x: unpack(Yfin, 0),
          y: unpack(Yfin, 1),
          z: unpack(Yfin, 2),
          mode: 'markers',
          marker: {
            size: 3,
            opacity: 0.8,
            color: g
          },
          type: 'scatter3d'
        }

        var data = [trace]
        var layout = {
          margin: {
            l: 0,
            r: 0,
            b: 0,
            t: 0
          }
        }
        Plotly.newPlot(this.divPlot, data, layout)
      }
      // console.log(Y, typeof graphPlot)
    }
  }
}

module.exports = Vis
