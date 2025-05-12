import * as d3 from 'd3'
import d3Tip from 'd3-tip'
import { PlotLauncher, brushDispatcher } from '../chart'
import { DataFrame } from '../data'

export class ScatterPlot extends PlotLauncher {
  constructor(container, innerW, innerH, margin, chartID, xAxisVis = false, yAxisVis = false) {
    super(container, innerW, innerH, margin, chartID, xAxisVis, yAxisVis)
  }

  draw(data, fields, scales) {
    const [xField, yField, cField, sField] = fields
    const innerW = this.innerW
    const innerH = this.innerH
    const margin = this.margin

    // 悬停标签
    const tip = getTips(fields)

    let g = this.plotContent

    // 数据预处理
    const DF = new DataFrame(data, fields, 3, innerW, innerH)
    let plotData = DF.plotData
    plotData = DF.addOffset(plotData)

    // 更新标题
    const supTitle = xField && yField ? `${yField} vs. ${xField}` : xField || yField || ''
    d3.select('.sup-title').text(supTitle)

    // 比例尺
    const xScale = d3.scaleLinear().domain(DF.getRange('x')).nice().range([0, innerW])
    const yScale = d3.scaleLinear().domain(DF.getRange('y')).nice().range([innerH, 0])

    // deprecated 本来是留给缩放用的
    let newXScale = xScale
    let newYScale = yScale

    // 坐标轴（第一次创建后复用）
    let xAxisG = g.select('g.x.axis')
    xAxisG = g.append('g').attr('class', 'x axis').attr('transform', `translate(0,${innerH})`)

    let yAxisG = g.select('g.y.axis')
    yAxisG = g.append('g').attr('class', 'y axis')

    if (this.xAxisVis) {
      const xTicks = xScale.ticks().slice(1, -1)
      let xAxis = d3.axisBottom(xScale).tickValues(xTicks)
      if (DF.xIsDis)
        xAxis
          .tickValues(DF.xCategories.map((_, i) => i + 0.5))
          .tickFormat((_, i) => DF.xCategories[i])
      xAxisG.call(xAxis)
      // 轴标签
      let xlabel = xAxisG.select('text.axis-label')
      xlabel = xAxisG
        .append('text')
        .attr('class', 'axis-label x-axis-label')
        .attr('x', innerW / 2)
        .attr('y', (margin.bottom * 2) / 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', 16)
        .attr('fill', '#333')
      xlabel.text(xField)
    }
    if (this.yAxisVis) {
      const yTicks = yScale.ticks().slice(1, -1)
      let yAxis = d3.axisLeft(yScale).tickValues(yTicks)
      if (DF.yIsDis)
        yAxis
          .tickValues(DF.yCategories.map((_, i) => i + 0.5))
          .tickFormat((_, i) => DF.yCategories[i])
      yAxisG.call(yAxis)
      let ylabel = yAxisG.select('text.axis-label')
      ylabel = yAxisG
        .append('text')
        .attr('class', 'axis-label y-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', (-margin.left * 2) / 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', 16)
        .attr('fill', '#333')
      ylabel.text(yField)
    }

    const rows = d3.selectAll('.table-div #data-table tbody tr')

    const externalBrush = selectedIds => {
      if (selectedIds.length === 0) {
        circles.classed('selected', false)
        circles.classed('unselected', false)

        rows.classed('selected', false)
      } else {
        circles
          .classed('selected', d => selectedIds.includes(d._id))
          .classed('unselected', d => !selectedIds.includes(d._id))

        rows.classed('selected', (d, i) => selectedIds.includes(i))
      }
    }

    brushDispatcher.on('brush.' + this.chartID, externalBrush)

    const brushBehavior = d3
      .brush()
      .extent([
        [0, 0],
        [innerW, innerH],
      ])
      .on('brush', ({ selection }) => {
        if (!selection) {
          gCircles.selectAll('circle.point').classed('selected', false)
          return
        }
        const [[x0, y0], [x1, y1]] = selection

        // 找出符合条件的点的 ._id
        const selectedIds = []
        circles.each(d => {
          const cx = newXScale(d._x) + (DF.xIsDis && !DF.yIsDis ? d._offset : 0)
          const cy = newYScale(d._y) + (DF.yIsDis && !DF.xIsDis ? d._offset : 0)
          if (x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1) {
            selectedIds.push(d._id)
          }
        })

        brushDispatcher.call('brush', null, selectedIds, this.chartID)
      })
      .on('end', event => {
        if (event.selection !== null) {
          // 去掉 brush 的框，并把 selection 设置为 null
          brushG.call(d3.brush().move, null)
        }
      })

    // 2. 添加 brush 容器
    const brushG = g.append('g').attr('class', 'brush').call(brushBehavior)
    brushG.lower()

    let gCircles = g.select('g.circles')

    // 初始化才执行
    if (gCircles.empty()) {
      gCircles = g.append('g').attr('class', 'circles').attr('clip-path', 'url(#plot-clip)')
    }

    const circles = gCircles
      .selectAll('circle.point')
      .data(plotData)
      .join(
        // Enter
        enter =>
          enter
            .append('circle')
            .attr('class', 'point')
            .attr('cx', d => xScale(d._x) + (DF.xIsDis && !DF.yIsDis ? d._offset : 0))
            .attr('cy', d => yScale(d._y) + (DF.yIsDis && !DF.xIsDis ? d._offset : 0))
            .attr('r', 0)
            .attr('fill', d => d._color)
            // .transition(t)
            .attr('r', d => d._size),
        // Update
        update =>
          update
            .attr('cx', d => xScale(d._x) + (DF.xIsDis && !DF.yIsDis ? d._offset : 0))
            .attr('cy', d => yScale(d._y) + (DF.yIsDis && !DF.xIsDis ? d._offset : 0))
            .attr('r', d => d._size)
            .attr('fill', d => d._color)
      )
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide)

    this.svg.call(tip)
  }
}

function getTips(fields) {
  // d3.selectAll('.d3-tip').remove()
  const [xField, yField, cField, sField] = fields
  return d3Tip()
    .attr('class', 'd3-tip')
    .offset([-5, 0])
    .html(function (event, d) {
      let hoverToolTips = '<table>'
      hoverToolTips += `<tr><td class="name">行</td><td>: ${d._id + 1}</td></tr>`
      if (xField) hoverToolTips += `<tr><td class="name">${xField}</td><td>: ${d.x}</td></tr>`
      if (yField) hoverToolTips += `<tr><td class="name">${yField}</td><td>: ${d.y}</td></tr>`
      if (cField) hoverToolTips += `<tr><td class="name">${cField}</td><td>: ${d.color}</td></tr>`
      if (sField) hoverToolTips += `<tr><td class="name">${sField}</td><td>: ${d.size}</td></tr>`
      hoverToolTips += '</table>'
      return hoverToolTips
    })
}
