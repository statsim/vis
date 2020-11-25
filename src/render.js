const FileSaver = require('file-saver')
const Plotly = require('./plotly-custom.js')
const vis = require('./vn.js')

console.log(vis)

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

    this.divImp = document.createElement('div')
    this.divImp.style.width = '100%'
    this.divImp.style.maxWidth = '600px'
    this.divImp.style.marginTop = '30px'
    this.outputs.appendChild(this.divImp)

    this.divPair = document.createElement('div')
    this.divPair.style.width = '100%'
    this.divPair.style.maxWidth = '600px'
    this.divPair.style.marginTop = '30px'
    this.outputs.appendChild(this.divPair)

    this.divCoord = document.createElement('div')
    this.divCoord.style.width = '100%'
    this.divCoord.style.maxWidth = '600px'
    this.divCoord.style.marginTop = '30px'
    this.outputs.appendChild(this.divCoord)

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

    this.divNet = document.createElement('div')
    this.divNet.style.width = '100%'
    this.divNet.style.maxWidth = '600px'
    this.divNet.style.marginTop = '30px'
    this.outputs.appendChild(this.divNet)
  }

  render (data) {
    console.log('[Render] Starting...')
    const { Y, X, params, nDims, featuresFiltered, recordsFiltered, target, g, colorscale, impMatrix, corr, imp } = data

    ;[this.divPlot, this.divImp, this.divPair, this.divCoord, this.divCorr, this.divMap, this.divNet].forEach(e => {
      e.innerHTML = ''
    })

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

    // Plot projection
    if (Y) {
      if (nDims === 2) {
        const trace = {
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
        const data = [trace]
        const layout = {
          title: params.method + '(2D)',
          hovermode: 'closest',
          height: 600,
          margin: {
            l: 0,
            r: 0,
            b: 0,
            t: 30
          }
        }
        Plotly.newPlot(this.divPlot, data, layout, { responsive: true })
        this.divPlot.on('plotly_selected', function (e) {
          if (e && e.points && Array.isArray(e.points)) {
            const selected = e.points.map(p => p.pointIndex)
            const recordsSelected = recordsFiltered.filter((_, i) => selected.includes(i))
            const keys = Object.keys(recordsSelected[0]).filter(key => key.length)
            const values = recordsSelected.map(row => keys.map(k => row[k]))
            let res = keys.join(',') + '\n'
            values.forEach(v => { res += v.join(',') + '\n' })
            const blob = new Blob([res], { type: 'text/plain;charset=utf-8' })
            FileSaver.saveAs(blob, 'selection.csv')
          }
        })
      } else {
        const trace = {
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
        const data = [trace]
        const layout = {
          title: params.method + '(3D)',
          hovermode: 'closest',
          height: 600,
          margin: {
            l: 0,
            r: 0,
            b: 0,
            t: 30
          }
        }
        Plotly.newPlot(this.divPlot, data, layout, { responsive: true })
      }
    }

    // Plot pairs and parallel coordinated plot
    if ((featuresFiltered && (featuresFiltered.length <= 5)) || imp) {
      // Parallel coords
      const dims = featuresFiltered
        .map((name, i) => ({
          imp: imp[i] || 1,
          label: name,
          values: unpack(X, i)
        }))
        .sort((a, b) => a.imp - b.imp)
        .slice(-5)
        .map(c => ({
          label: c.label,
          values: c.values
        }))

      const coordData = [{
        type: 'parcoords',
        // pad: [80, 80, 80, 80],
        line: {
          showscale: true,
          color: target,
          colorscale
        },
        dimensions: dims
        /*
        dimensions: featuresFiltered.map((f, i) => {
          const col = unpack(X, i)
          return {
            label: f,
            values: col,
            // range: [Math.min.apply(null, col), Math.max.apply(null, col)]
          }
        })
        */
      }]
      const coordLayout = {
        // width: 800
        title: 'Parallel Coordinates' + (dims.length < featuresFiltered.length ? ' (Top ' + dims.length + ' features)' : ''),
        height: 420,
        margin: {
          l: 50,
          r: 5,
          b: 5,
          t: 120
        }
      }
      Plotly.newPlot(this.divCoord, coordData, coordLayout)

      // Pair plot
      const axis = () => ({
        showline: false,
        zeroline: false,
        ticklen: 4
      })
      const data = [{
        type: 'splom',
        dimensions: dims,
        text: g && g.length ? g.map(el => '<b>' + el + '</b>') : null,
        marker: {
          color: target,
          colorscale: colorscale,
          opacity: 0.7,
          size: 4
        }
      }]

      const layout = {
        title: 'Pair plot' + (dims.length < featuresFiltered.length ? ' (Top ' + dims.length + ' features)' : ''),
        hovermode: 'closest',
        height: 600,
        margin: {
          l: 50,
          r: 0,
          b: 50,
          t: 30
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

      Plotly.newPlot(this.divPair, data, layout, { responsive: true })
    } else {
      this.divPair.innerHTML = ''
    }

    const heatColorscale = [
      [0, '#2f2fb7'],
      [0.5, '#dddddd'],
      [1.0, '#d90368']
    ]

    if (impMatrix) {
      console.log('[Vis] Rendering imp matrix:', impMatrix)
      const data = [
        {
          z: impMatrix,
          x: featuresFiltered,
          y: featuresFiltered,
          type: 'heatmap',
          colorscale: heatColorscale,
          hoverongaps: false
        }
      ]
      const layout = {
        title: 'Cross-variable importance',
        height: 600,
        margin: {
          l: 50,
          r: 0,
          b: 100,
          t: 30
        },
        xaxis: {
          ticks: '',
          tickangle: -45,
          side: 'bottom'
        },
        yaxis: {
          ticks: '',
          autorange: 'reversed'
        }
      }
      Plotly.newPlot(this.divMap, data, layout)

      // Draw network

      const max = Math.max(...([].concat(...impMatrix)))
      const marginalImp = Array(impMatrix.length).fill(0)
      impMatrix.forEach((imp, i) => {
        imp.forEach((v, j) => { marginalImp[j] += v / (max > 0 ? max : 1) })
      })

      console.log('MI', marginalImp)

      const nodes = new vis.DataSet(featuresFiltered.map((f, i) => ({
        id: i,
        label: f,
        value: marginalImp[i] * 10,
        group: (marginalImp[i] / (max > 0 ? max : 1) > 0.2) ? 'active' : 'passive'
      })))

      const edgesTemp = []
      impMatrix.forEach((imp, i) => {
        imp.forEach((v, j) => {
          const val = v / (max > 0 ? max : 1)
          if (v > max * 0.2) {
            edgesTemp.push({
              from: j,
              to: i,
              value: val,
              color: { color: '#7F92CF', opacity: val }
            })
          }
        })
      })
      console.log(edgesTemp)
      const edges = new vis.DataSet(edgesTemp)

      // create a network
      var dat = {
        nodes: nodes,
        edges: edges
      }
      var options = {
        nodes: {
          shape: 'dot',
          scaling: {
            customScalingFunction: function (min, max, total, value) {
              return value / total
            },
            min: 3,
            max: 25
          }
        },
        groups: {
          active: {
            shape: 'dot',
            color: '#3030B7'
          },
          passive: {
            shape: 'dot',
            color: '#5E78CB'
          }
        }
      }

      this.divNet.style.width = '600px'
      this.divNet.style.height = '600px'
      const network = new vis.Network(this.divNet, dat, options)
      console.log('[Vis] Network created:', typeof network)
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
        title: 'Correlation (All variables)',
        height: 600,
        margin: {
          l: 50,
          r: 0,
          b: 100,
          t: 30
        },
        xaxis: {
          ticks: '',
          tickangle: -45,
          side: 'bottom'
        },
        yaxis: {
          ticks: '',
          autorange: 'reversed'
        }
      }
      Plotly.newPlot(this.divCorr, data, layout)
    }

    if (imp) {
      const impMax = Math.max.apply(null, imp)
      const imps = imp.map((v, i) => ({
        imp: v / (impMax || 1),
        name: featuresFiltered[i]
      })).sort((a, b) => a.imp - b.imp)
      const colors = imps.map((v, i) => /* v.imp < 0.5 */ i < imps.length - 5 ? '#BBB' : '#3030B7')
      const traceImp = {
        x: imps.map(v => v.name),
        y: imps.map(v => v.imp),
        type: 'bar',
        // text: imp,
        marker: {
          color: colors,
          opacity: 0.8
        }
      }
      const data = [traceImp]
      const layout = {
        title: 'Feature Importance (RF)',
        showlegend: false,
        height: 400,
        margin: {
          l: 50,
          r: 0,
          b: 80,
          t: 30
        },
        xaxis: {
          tickangle: -45
        },
        yaxis: {
          zeroline: false,
          gridwidth: 1
        },
        bargap: 0.05
      }
      Plotly.newPlot(this.divImp, data, layout)
    }
  }
}
