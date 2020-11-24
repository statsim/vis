// const Dygraph = require('dygraphs')
const TSNE = require('tsne').tSNE
const { Matrix, correlation } = require('ml-matrix')
const PCA = require('ml-pca').PCA
const SOM = require('ml-som')
const UMAP = require('umap-js').UMAP
const Autoencoder = require('autoencoder')
const parse = require('csv-parse/lib/sync')
const { RandomForest } = require('random-forest')

module.exports = class Process {
  constructor () {
    this.file = ''
    this.records = []
    this.keys = []
  }

  run (p) {
    const params = {
      file: p['File'],
      dimensions: p['Dimensions'],
      column: p['Target variable'],
      transform: p['Transform'],
      method: p['Projection method'],
      steps: p['Steps'],
      importance: p['Feature importance']
    }
    if (!params.file && !this.file.length) {
      console.log('[Vis] No file provided')
      throw new Error('No file selected')
    } else if (params.file !== this.file) {
      // New file, return columns
      console.log('[Vis] Parsing the file')
      this.file = params.file
      this.records = parse(params.file, {
        columns: true,
        skip_empty_lines: true
      })
      this.keys = Object.keys(this.records[0]).filter(key => key.length)
      return {
        'Target variable': {
          options: ['None'].concat(this.keys)
        }
      }
    } else {
      // File is not new, do dimensionality reduction
      const len = this.records.length || 1
      const nDims = parseInt(params.dimensions)
      const features = this.keys.filter(k => (k !== params.column) && k.length)
      const Xraw = new Matrix(this.records.map(row => features.map(f => row[f])))
      const featuresFiltered = []

      let imp
      let impMatrix

      // Remove columns with many NaNs
      console.log('[Vis] Transforming data')
      const cols = []
      for (let i = 0; i < Xraw.columns; i++) {
        const col = Xraw.getColumn(i)
        const na = col.reduce((a, x) => a + isNaN(x), 0)
        console.log('[Vis] Number of NaNs in the variable:', features[i], na, 100 * na / len + '%')
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
        const row = X.getRow(i)
        const na = row.reduce((a, x) => a + isNaN(x), 0)
        if (na === 0) {
          rows.push(i)
        }
      }
      X = X.subMatrixRow(rows)
      const recordsFiltered = this.records.filter((_, ri) => rows.includes(ri))

      // Compute correlation
      const corr = correlation(new Matrix(X)).to2DArray()

      // Convert X to a native 2d array
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
        Y = pca.predict(X, { 'nComponents': nDims}).to2DArray()
      } else if (params.method === 'SOM') {
        const som = new SOM(100, 100, { 'iterations': Math.round(params.steps / 10), 'fields': X[0].length})
        som.train(X)
        Y = som.predict(X)
        if (nDims === 3) {
          Y = Y.map(y => y.concat([0]))
        }
      } else if (params.method === 'UMAP') {
        console.log('[Vis] Fitting UMAP')
        const umap = new UMAP({ 'nComponents': nDims, 'nEpochs': params.steps })
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

        impMatrix = []

        console.log('[Vis] Generate importance matrix with Autoencoder')
        featuresFiltered.forEach((f, fi) => {
          const impTemp = []
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
            impTemp.push(mse)
          })
          impMatrix.push(impTemp)
        })
        console.log('[Vis] Autoencoder importance matrix:', impMatrix)
        impMatrix = new Matrix(impMatrix).scaleColumns().to2DArray()
      } else {
        console.log('[Vis] Fitting t-SNE')
        const tsne = new TSNE({ 'epsilon': 10, 'dim': nDims })
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
        console.log('[Vis] Target variable is present')
        g = this.records.map(row => row[params.column]).filter((_, i) => rows.includes(i))
        const groups = [...new Set(g)].sort((a, b) => a > b)
        console.log('[Vis] Number of unique values: %d%', X.length ? g.length / X.length : 0)
        target = g.map((group, i) => groups.findIndex(el => el === group) / (groups.length > 2 ? groups.length - 1 : 1))
        colorscale = [
          [0.0, '#d90368'],
          [0.25, '#ffd400'],
          [0.5, '#4ecc35'],
          [0.75, '#119ddd'],
          [1, '#2f2fb7']
        ]

        if (params.importance === 'Random Forest') {
          console.log('[Vis] Fitting random forest')
          const rf = new RandomForest({
            nEstimators: 50,
            maxDepth: 10,
            maxFeatures: 'auto'
          })
          rf.train(X, g)
          imp = rf.getFeatureImportances(X, g, { n: 3, means: true, verbose: true })
          console.log('[Vis] Trained random forest:', rf)
          console.log('[Vis] Importance:', imp)
        }
      } else {
        console.log('[Vis] No target variable specified')
        target = Array(Y.length).fill(0)
        colorscale = [
          [0, '#8A8DA1'],
          [1, '#8A8DA1']
        ]

        if (params.importance === 'Random Forest') {
          console.log('[Vis] Fitting random forest on all variables')
          console.log(X, featuresFiltered, featuresFiltered.length)
          impMatrix = featuresFiltered.map((f, i) => {
            console.log(`Calculating ${i} of ${featuresFiltered.length}: ${f}`)
            const Xtemp = X.map(row => row.filter((_, j) => j !== i))
            const gtemp = X.map(row => row.filter((_, j) => j === i))
            const rf = new RandomForest({
              nEstimators: 50,
              maxDepth: 5,
              maxFeatures: 'auto'
            })
            rf.train(Xtemp, gtemp)
            const impTemp = rf.getFeatureImportances(Xtemp, gtemp, { n: 3, means: true, verbose: false })
            // Add importance of the target feature on itself
            impTemp.splice(i, 0, 0)
            return impTemp
          })
        }
      }

      return { Y, X, params, nDims, featuresFiltered, recordsFiltered, target, g, colorscale, impMatrix, corr, imp }
    }
  }
}
