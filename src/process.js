// const Dygraph = require('dygraphs')
const TSNE = require('tsne').tSNE
const {Matrix, correlation} = require('ml-matrix')
const PCA = require('ml-pca').PCA
const SOM = require('ml-som')
const UMAP = require('umap-js').UMAP
const Autoencoder = require('autoencoder')
const parse = require('csv-parse/lib/sync')

module.exports = class Process {
  constructor () {
    this.file = ''
    this.records = []
    this.keys = []
  }
  run (params) {
    if (!params.file && !this.file.length) {
      console.log('[Vis] No file provided')
      throw new Error('No file selected')
    } else if (params.file !== this.file) {
      // New file, return columns
      console.log('[Vis] Parse file', params.file)
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

      if (params.transform) {
        if (params.transform === 'Scale') {
          // Transform: Scale
          console.log('[Vis] Scale input matrix X')
          X = X.scaleColumns()
        } else if (params.transform === 'Log') {
          // Transform: Log
          console.log('[Vis] Log-transform matrix X')
          X = X.add(1).log()
        }
      }

      // Remove rows with NaN
      const rows = []
      for (let i = 0; i < len; i++) {
        let row = X.getRow(i)
        let na = row.reduce((a, x) => a + isNaN(x), 0)
        if (na === 0) {
          rows.push(i)
        }
      }
      X = X.subMatrixRow(rows)

      // Convert X to a native 2d array
      let corr = correlation(X).to2DArray()

      X = X.to2DArray()

      console.log('[Vis] Target variable:', params.column ? params.column : 'None')
      console.log('[Vis] Keys:', this.keys)
      console.log('[Vis] Features:', features)
      console.log('[Vis] Features (filtered):', featuresFiltered)
      console.log('[Vis] Embedding method:', params.method)

      let Y
      if (params.method === 'PCA') {
        console.log('[Vis] Fitting PCA')
        const pca = new PCA(X)
        Y = pca.predict(X, {'nComponents': nDims}).to2DArray()
      } else if (params.method === 'SOM') {
        const som = new SOM(100, 100, {'iterations': Math.round(params.steps / 10), 'fields': X[0].length})
        som.train(X)
        Y = som.predict(X)
        if (nDims === 3) {
          Y = Y.map(y => y.concat([0]))
        }
      } else if (params.method === 'UMAP') {
        console.log('[Vis] Fitting UMAP')
        const umap = new UMAP({'nComponents': nDims, 'nEpochs': params.steps})
        umap.initializeFit(X)
        for (let i = 0; i < params.steps; i++) {
          umap.step()
        }
        Y = umap.getEmbedding()
      } else if (params.method === 'Autoencoder') {
        console.log('[Vis] Fitting Autoencoder')
        // const ae = new Autoencoder({'nInputs': cols.length, 'nHidden': nDims, 'nLayers': 3, 'activation': 'tanh'})
        const ae = new Autoencoder({
          'encoder': [
            {'nOut': 20, 'activation': 'tanh'},
            {'nOut': nDims, 'activation': 'sigmoid'}
          ],
          'decoder': [
            {'nOut': 20, 'activation': 'tanh'},
            {'nOut': cols.length}
          ]
        })
        ae.fit(X, {
          'iterations': params.steps * 50,
          'stepSize': 0.005,
          'batchSize': 20,
          'method': 'adam'
        })
        Y = ae.encode(X)

        var impMatrix = []
        featuresFiltered.forEach((f, fi) => {
          const imp = []
          const Xr = []
          X.forEach(x => Xr.push(x.slice(0)))
          for (let i = Xr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const x = Xr[i][fi]
            Xr[i][fi] = Xr[j][fi]
            Xr[j][fi] = x
          }
          const Xp = ae.predict(Xr)
          featuresFiltered.forEach((ff, ffi) => {
            const mse = Xp.reduce((a, x, xi) => Math.pow(x[ffi] - X[xi][ffi], 2) + a, 0) / Xp.length
            imp.push(mse)
          })
          impMatrix.push(imp)
        })
        console.log(impMatrix)
        impMatrix = new Matrix(impMatrix).scaleColumns().to2DArray()
      } else {
        const tsne = new TSNE({'epsilon': 10, 'dim': nDims})
        tsne.initDataRaw(X)
        const steps = params.steps || 100
        for (let k = 0; k <= steps; k++) {
          tsne.step()
        }
        Y = tsne.getSolution()
      }

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
          [0, '#8A8DA1'],
          [1, '#8A8DA1']
        ]
      }

      return {Y, X, params, nDims, featuresFiltered, target, g, colorscale, impMatrix, corr}
    }
  }
}
