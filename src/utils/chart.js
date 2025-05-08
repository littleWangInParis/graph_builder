// src/utils/chart.js
/* 
 TODO xFields 改为 array，拖入就加一个
 TODO 切换图像 zoom 时候轴的变化有问题
 TODO 拖出变量
 TODO 拖拽调整大小

 */
import * as d3 from 'd3'
import d3Tip from 'd3-tip'
import { DataFrame } from './data'

export function initGraphBuilder(container, innerW, innerH, outerW, outerH, margin) {
  const gbSVG = d3.select(container)

  // 白色背景
  gbSVG
    .append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', innerW)
    .attr('height', innerH)
    .attr('fill', 'white')

  // 拖拽文字提示
  gbSVG
    .append('text')
    .attr('class', 'drag-hint')
    .attr('x', (2 * margin.left + innerW) / 2)
    .attr('y', (2 * margin.top + innerH) / 2)
    .attr('text-anchor', 'middle')
    .text('Drag variables into drop zones')

  gbSVG.attr('viewBox', [0, 0, outerW, outerH])

  /* 
    SVG 元素本质上是无限大的
    viewBox 设置拍下的照片的范围
    viewPort 是展示照片的相框
    SVG 的 width 和 height 其实是设置视窗 viewPort 的 
    */
}

export class PlotLauncher {
  constructor(container, width, height, margin, chartID) {
    this.margin = margin
    this.width = width
    this.height = height
    this.innerW = width - margin.left - margin.right
    this.innerH = height - margin.top - margin.bottom
    this.chartID = chartID

    this.svg = d3
      .select(container)
      .append('svg')
      .attr('class', `svg-${chartID}`)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])

    this.plotContent = this.svg
      .append('g')
      .attr('class', 'plot-content')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    this.plotContent
      .append('defs')
      .append('clipPath')
      .attr('id', `plot-clip-${chartID}`)
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.innerW)
      .attr('height', this.innerH)
  }

  drawScatter(data, fields) {
    const [xField, yField, cField, sField] = fields
    const innerW = this.innerW
    const innerH = this.innerH
    const margin = this.margin

    // 悬停标签
    const tip = getTips(fields)

    let g = this.plotContent

    g.selectAll('g:not(.circles)') // 替换为你的父 <g> 的选择器
      .remove()

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
    let newXScale = xScale
    let newYScale = yScale

    // 过渡对象
    const t = this.svg.transition().duration(500)

    // 坐标轴（第一次创建后复用）
    let xAxisG = g.select('g.x.axis')
    if (xAxisG.empty()) {
      xAxisG = g.append('g').attr('class', 'x axis').attr('transform', `translate(0,${innerH})`)
    }
    let yAxisG = g.select('g.y.axis')
    if (yAxisG.empty()) {
      yAxisG = g.append('g').attr('class', 'y axis')
    }

    // 更新坐标轴
    let xAxis = d3.axisBottom(xScale)
    let yAxis = d3.axisLeft(yScale)
    if (DF.xIsDis)
      xAxis
        .tickValues(DF.xCategories.map((_, i) => i + 0.5))
        .tickFormat((_, i) => DF.xCategories[i])
    if (DF.yIsDis)
      yAxis
        .tickValues(DF.yCategories.map((_, i) => i + 0.5))
        .tickFormat((_, i) => DF.yCategories[i])
    xAxisG.call(xAxis)
    yAxisG.call(yAxis)

    // 轴标签
    let xlabel = xAxisG.select('text.axis-label')
    if (xlabel.empty()) {
      xlabel = xAxisG
        .append('text')
        .attr('class', 'axis-label x-axis-label')
        .attr('x', innerW / 2)
        .attr('y', (margin.bottom * 2) / 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', 16)
        .attr('fill', '#333')
    }
    xlabel.text(xField)

    let ylabel = yAxisG.select('text.axis-label')
    if (ylabel.empty()) {
      ylabel = yAxisG
        .append('text')
        .attr('class', 'axis-label y-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', (-margin.left * 2) / 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', 16)
        .attr('fill', '#333')
    }
    ylabel.text(yField)

    d3.selectAll('.brush').remove()
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
        if (selectedIds.length === 0) {
          circles.classed('selected', false)
          circles.classed('unselected', false)
        } else {
          circles
            .classed('selected', d => selectedIds.includes(d._id))
            .classed('unselected', d => !selectedIds.includes(d._id))
        }
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
            .transition(t)
            .attr('r', d => d._size),
        // Update
        update =>
          update
            .transition(t)
            // .delay((d, i) => i * 0.5) // 如果需要延迟动画
            .attr('cx', d => xScale(d._x) + (DF.xIsDis && !DF.yIsDis ? d._offset : 0))
            .attr('cy', d => yScale(d._y) + (DF.yIsDis && !DF.xIsDis ? d._offset : 0))
            .attr('r', d => d._size)
            .attr('fill', d => d._color),

        // Exit
        exit => exit.transition(t).attr('r', 0).remove()
      )
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide)

    this.svg.call(tip)
  }

  /**
   * 绘制直方图
   * @param {Array<Object>} data 原始数据数组
   * @param {Array<string>} fields 字段数组，取第一个字段作为绘制目标
   * @param {number} innerW 绘图区宽度
   * @param {number} innerH 绘图区高度
   * @param {Object} margin 边距对象 {top, right, bottom, left}
   */
  drawHistogram(data, fields) {
    const [xField] = fields
    const innerW = this.innerW
    const innerH = this.innerH
    const margin = this.margin

    const histTitle = xField ? xField : ''
    d3.select('.sup-title').text(histTitle)

    // 创建或清空容器
    let g = this.svg.select('g.plot-content')

    g.selectAll('*')
      // 动画效果
      // .transition()
      // .duration(300)
      // .style('opacity', 0)
      .remove()

    // 数据提取
    const values = data.map(d => +d[xField]).filter(v => !isNaN(v))
    // X 轴比例尺
    const xScale = d3.scaleLinear().domain(d3.extent(values)).nice().range([0, innerW])

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
    const yMax = d3.max(bins, d => d.length)
    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0])

    // 绘制坐标轴
    const xAxis = d3.axisBottom(xScale)
    const yAxis = d3.axisLeft(yScale)

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

    const stripedens = 7

    const pattern = g
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

    barsG
      .selectAll('rect.bar')
      .data(bins)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.x0))
      // .attr('y', innerH)
      .attr('y', d => yScale(d.length))
      .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0)))
      .attr('height', d => innerH - yScale(d.length))
      // .attr('height', 0)
      .attr('opacity', 0)
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide)
      .transition()
      .duration(300)
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
        const filtered = values.filter(v => xScale(v) >= x0 && xScale(v) <= x1)
        // console.log(filtered)

        const newBins = d3
          .bin()
          .value(d => d)
          .domain(xScale.domain())
          .thresholds(thresholds)(filtered)

        // console.log(newBins)
        selG.selectAll('rect').remove()
        selG
          .selectAll('rect')
          .data(newBins)
          .join('rect')
          .attr('class', 'bar-selected')
          .attr('x', d => xScale(d.x0))
          .attr('y', d => yScale(d.length))
          .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0)))
          .attr('height', d => innerH - yScale(d.length))
      })
      .on('end', event => {
        if (event.selection !== null) {
          brushG.call(d3.brush().move, null)
        }
      })

    const brushG = g.append('g').attr('class', 'brush').call(brushBehavior)
    // 这样可以让 tips 显示 但是无法应用 brush 了
    // brushG.select('.overlay').style('pointer-events', 'none')
  }
}

/*
  // 定义缩放行为
  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.7, 3])
    .filter(event => event instanceof WheelEvent)
    // .translateExtent([
    //   [0, 0],
    //   [innerW, innerH],
    // ]) // 可平移范围
    .on('zoom', zoomed)

  // 将 zoom 绑定到整个 svg
  g.call(zoomBehavior)

  // zoom 回调：用 transform 更新轴和散点位置
  function zoomed(event) {
    const transform = event.transform
    newXScale = transform.rescaleX(xScale)
    newYScale = transform.rescaleY(yScale)

    xAxis = d3.axisBottom(newXScale)
    yAxis = d3.axisLeft(newYScale)
    if (DF.xIsDis)
      xAxis
        .tickValues(DF.xCategories.map((_, i) => i + 0.5))
        .tickFormat((_, i) => DF.xCategories[i])
    if (DF.yIsDis)
      yAxis
        .tickValues(DF.yCategories.map((_, i) => i + 0.5))
        .tickFormat((_, i) => DF.yCategories[i])
    xAxisG.call(xAxis)
    yAxisG.call(yAxis)
    gCircles
      .selectAll('circle.point')
      .attr('cx', d => newXScale(d._x) + (DF.xIsDis && !DF.yIsDis ? d._offset : 0))
      .attr('cy', d => newYScale(d._y) + (DF.yIsDis && !DF.xIsDis ? d._offset : 0))
  }
*/

function getTips(fields) {
  d3.selectAll('.d3-tip').remove()
  const [xField, yField, cField, sField] = fields
  return d3Tip()
    .attr('class', 'd3-tip')
    .offset([-5, 0])
    .html(function (event, d) {
      let hoverToolTips = '<table>'
      if (xField) hoverToolTips += `<tr><td class="name">${xField}</td><td>: ${d.x}</td></tr>`
      if (yField) hoverToolTips += `<tr><td class="name">${yField}</td><td>: ${d.y}</td></tr>`
      if (cField) hoverToolTips += `<tr><td class="name">${cField}</td><td>: ${d.color}</td></tr>`
      if (sField) hoverToolTips += `<tr><td class="name">${sField}</td><td>: ${d.size}</td></tr>`
      hoverToolTips += '</table>'
      return hoverToolTips
    })
}
