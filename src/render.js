const Plotly = require('./plotly-custom.js')

function unpack (rows, key) {
  return rows.map(row => row[key])
}

module.exports = class Render {
  constructor () {
    this.outputs = document.getElementById('outputs')
    this.divPlot = document.createElement('div')
    this.divPlot.style.width = '100%'
    this.divPlot.style.maxWidth = '600px'
    this.outputs.appendChild(this.divPlot)

    this.divPair = document.createElement('div')
    this.divPair.style.width = '100%'
    this.divPair.style.maxWidth = '600px'
    this.divPair.style.marginTop = '30px'
    this.outputs.appendChild(this.divPair)

    this.divCorr = document.createElement('div')
    this.divCorr.style.width = '100%'
    this.divCorr.style.maxWidth = '600px'
    this.divCorr.style.marginTop = '30px'
    this.outputs.appendChild(this.divCorr)

    this.divMap = document.createElement('div')
    this.divMap.style.width = '100%'
    this.divMap.style.maxWidth = '600px'
    this.divMap.style.marginTop = '30px'
    this.outputs.appendChild(this.divMap)
  }

  render (data) {
    const {Y, X, params, nDims, featuresFiltered, target, g, colorscale, impMatrix, corr} = data

    /*
    if (!this.outputs.innerText.length) {
      this.outputs.appendChild(this.divPlot)
      this.outputs.appendChild(this.divPair)
      this.outputs.appendChild(this.divCorr)
      this.outputs.appendChild(this.divMap)
    }
    */

    const text = X.map((x, i) => {
      let label = g && g.length ? '→ <b>' + g[i] + '</b>' : ''
      if (featuresFiltered.length < 7) {
        x.map((el, j) => {
          label += '<br><b>' + featuresFiltered[j] + '</b>: ' + el.toFixed(3)
        })
      }
      return label
    })

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
        text: text,
        type: 'scatter'
      }
      let data = [ trace ]
      let layout = {
        title: params.method + '(2D)',
        hovermode: 'closest',
        height: 600,
        margin: {
          l: 0,
          r: 0,
          b: 0,
          t: 40
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
          size: 2,
          opacity: 0.7,
          color: target,
          colorscale: colorscale
        },
        text: g && g.length ? g.map(el => '<b>' + el + '</b>') : null,
        type: 'scatter3d'
      }
      let data = [trace]
      let layout = {
        title: params.method + '(3D)',
        hovermode: 'closest',
        height: 600,
        margin: {
          l: 0,
          r: 0,
          b: 0,
          t: 40
        }
      }
      Plotly.newPlot(this.divPlot, data, layout, {responsive: true})
    }

    // Plot pairs
    if (featuresFiltered && (featuresFiltered.length < 10)) {
      let axis = () => ({
        'showline': false,
        'zeroline': false,
        // 'gridcolor': '#ffff',
        'ticklen': 4
      })
      let splomDimensions = featuresFiltered.map((f, i) => ({'label': f, 'values': unpack(X, i)}))
      let data = [{
        type: 'splom',
        dimensions: splomDimensions,
        text: g && g.length ? g.map(el => '<b>' + el + '</b>') : null,
        marker: {
          color: target,
          colorscale: colorscale,
          opacity: 0.7,
          size: 4
        }
      }]

      let layout = {
        title: 'Pair plot',
        hovermode: 'closest',
        height: 600,
        margin: {
          l: 0,
          r: 0,
          b: 0,
          t: 40
        },
        xaxis: axis(),
        yaxis: axis(),
        xaxis2: axis(),
        xaxis3: axis(),
        xaxis4: axis(),
        yaxis2: axis(),
        yaxis3: axis(),
        yaxis4: axis()
      }

      Plotly.newPlot(this.divPair, data, layout, {responsive: true})
    } else {
      this.divPair.innerHTML = ''
    }

    const heatColorscale = [
      [0, '#2f2fb7'],
      [0.5, '#dddddd'],
      [1.0, '#d90368']
    ]

    if (impMatrix) {
      let data = [
        {
          z: impMatrix,
          x: featuresFiltered,
          y: featuresFiltered,
          type: 'heatmap',
          colorscale: heatColorscale,
          hoverongaps: false
        }
      ]
      let layout = {
        title: 'AE importance',
        height: 600,
        xaxis: {
          ticks: '',
          side: 'top'
        },
        yaxis: {
          ticks: '',
          autorange: 'reversed'
        }
      }
      Plotly.newPlot(this.divMap, data, layout)
    }

    if (corr) {
      let data = [
        {
          z: corr,
          x: featuresFiltered,
          y: featuresFiltered,
          type: 'heatmap',
          colorscale: heatColorscale,
          hoverongaps: false
        }
      ]
      let layout = {
        title: 'Correlation',
        height: 600,
        xaxis: {
          ticks: '',
          side: 'top'
        },
        yaxis: {
          ticks: '',
          autorange: 'reversed'
        }
      }
      Plotly.newPlot(this.divCorr, data, layout)
    }
  }
}
