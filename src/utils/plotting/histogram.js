import * as d3 from 'd3'
import d3Tip from 'd3-tip'
import { PlotLauncher, brushDispatcher } from '../chart'
import { calculateDomain } from '../tools'
import throttle from 'lodash.throttle'

export class HistogramPlot extends PlotLauncher {
  constructor(container, innerW, innerH, margin, chartID, xAxisVis = false, yAxisVis = false) {
    super(container, innerW, innerH, margin, chartID, xAxisVis, yAxisVis)
    const stripedens = 7
    const pattern = gbSVG
      .append('defs')
      .append('pattern')
      .attr('id', 'hist-stripes')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', innerW)
      .attr('height', innerH)

    // 背景
    pattern.append('rect').attr('width', innerW).attr('height', innerH)

    // 斜线：左上到右下
    for (let i = -innerH; i < innerH; i += stripedens) {
      pattern
        .append('line')
        .attr('x1', 0)
        .attr('y1', i)
        .attr('x2', innerW)
        .attr('y2', innerH + i)
    }
  }

  draw(data, fields, yMax) {
    const [xField] = fields
    const innerW = this.innerW
    const innerH = this.innerH
    const margin = this.margin

    const histTitle = xField ? xField : ''
    d3.select('.sup-title').text(histTitle)

    // 创建或清空容器
    let g = this.plotContent

    // 数据提取
    const df = data.map((d, i) => ({ _id: i, _x: +d[xField] }))
    const xValues = data.map(d => +d[xField])

    const xDomain = calculateDomain(d3.extent(xValues))
    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerW])

    // 分箱规则，ticks 函数会按照图像易读性调整分箱数量
    const thresholds = xScale.ticks(12)

    // 生成 bins
    const binGen = d3
      .bin()
      .value(d => +d[xField])
      .domain(xScale.domain())
      .thresholds(thresholds)

    const bins = binGen(data)

    // Y 轴比例尺
    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0])

    // 绘制坐标轴
    if (this.xAxisVis) {
      const xAxis = d3.axisBottom(xScale)
      g.append('g')
        .attr('class', 'x axis')
        .attr('transform', `translate(0,${innerH})`)
        .call(xAxis)
        .append('text')
        .attr('class', 'axis-label x-axis-label')
        .attr('x', innerW / 2)
        .attr('y', (margin.bottom * 2) / 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', 16)
        .attr('fill', '#333')
        .text(xField)
    }

    if (this.yAxisVis) {
      const yTicks = yScale.ticks().slice(1, -1)
      const yAxis = d3.axisLeft(yScale).tickValues(yTicks)
      g.append('g')
        .attr('class', 'y axis')
        .call(yAxis)
        .append('text')
        .attr('class', 'axis-label y-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', (-margin.left * 2) / 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', 16)
        .attr('fill', '#333')
        .text('Count')
    }
    // 提示框
    const tip = d3Tip()
      .attr('class', 'd3-tip')
      .offset([-5, 0])
      .html(
        (event, d) =>
          `<table>
                      <tr><td class="name">Range</td><td>: [${d.x0.toFixed(2)}, ${d.x1.toFixed(
            2
          )})</td></tr><tr><td class="name">Count</td><td>: ${d.length}</td></tr></table>`
      )

    this.svg.call(tip)
    // 绘制条形
    const barsG = g.append('g').attr('class', 'bars').attr('clip-path', 'url(#plot-clip)')

    barsG
      .selectAll('rect.bar')
      .data(bins)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.x0))
      .attr('y', d => yScale(d.length))
      .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0)))
      .attr('height', d => innerH - yScale(d.length))
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide)
      .attr('opacity', 1)

    const selG = g.append('g').attr('class', 'bars-selected')

    // 区间刷选
    const brushBehavior = d3
      .brush()
      .extent([
        [0, 0],
        [innerW, innerH],
      ])
      .on('brush', event => {
        const sel = event.selection
        if (!sel) {
          barsG.selectAll('rect.bar').classed('selected', false)
          return
        }
        const x0 = sel[0][0]
        const x1 = sel[1][0]
        const selectedIds = df.filter(d => xScale(d._x) >= x0 && xScale(d._x) <= x1).map(d => d._id)
        brushDispatcher.call('brush', null, selectedIds, this.chartID)
      })
      .on('end', event => {
        if (event.selection !== null) {
          brushG.call(d3.brush().move, null)
        }
      })

    const rows = d3.selectAll('.table-div #data-table tbody tr')

    // 节流为 50 ms 更新一次图像
    const externalBrush = throttle(selectedIds => {
      console.log(this.chartID)
      rows.classed('selected', (_, i) => selectedIds.includes(i))
      const newXValues = df.filter(d => selectedIds.includes(d._id)).map(d => d._x)
      const newBins = d3
        .bin()
        .value(d => d)
        .domain(xScale.domain())
        .thresholds(thresholds)(newXValues)

      selG
        .selectAll('rect')
        .data(newBins)
        .join('rect')
        .attr('class', 'bar-selected')
        .attr('x', d => xScale(d.x0))
        .attr('y', d => yScale(d.length))
        .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0)))
        .attr('height', d => innerH - yScale(d.length))
    }, 50)
    brushDispatcher.on('brush.' + this.chartID, externalBrush)
    const brushG = g.append('g').attr('class', 'brush').call(brushBehavior)
  }
}
