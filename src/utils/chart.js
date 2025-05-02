// src/utils/chart.js
/* 
 TODO 切换图像 zoom 时候轴的变化有问题
 TODO 拖出变量
 TODO 拖拽调整大小

 */
import * as d3 from 'd3'
import d3Tip from 'd3-tip'
import { DataFrame } from './data'

// 初始化图表
export function initChart(svgRef, innerW, innerH, outerW, outerH, margin) {
  const svg = d3.select(svgRef)

  svg
    .append('defs')
    .append('clipPath')
    .attr('id', 'plot-clip')
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', innerW)
    .attr('height', innerH)

  /* 
  SVG 元素本质上是无限大的
  viewBox 设置拍下的照片的范围
  viewPort 是展示照片的相框
  SVG 的 width 和 height 其实是设置视窗 viewPort 的 
  */

  // 白色背景
  svg
    .append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', innerW)
    .attr('height', innerH)
    .attr('fill', 'white')

  // 拖拽文字提示
  svg
    .append('text')
    .attr('class', 'drag-hint')
    .attr('x', (2 * margin.left + innerW) / 2)
    .attr('y', (2 * margin.top + innerH) / 2)
    .attr('text-anchor', 'middle')
    .text('Drag variables into drop zones')

  svg.attr('viewBox', [0, 0, outerW, outerH])
}

let xFieldSetter = () => {}
let yFieldSetter = () => {}
let colorFieldSetter = () => {}
let sizeFieldSetter = () => {}

// 注入 setter
export function setFieldSetters({ setX, setY, setC, setS }) {
  xFieldSetter = setX
  yFieldSetter = setY
  colorFieldSetter = setC
  sizeFieldSetter = setS
}

// 更新图
export function updateChart(svgRef, data, fields, innerW, innerH, margin) {
  const svg = d3.select(svgRef)
  const [xField, yField, cField, sField] = fields

  // modifyPlotConfigs(svg, fields)

  // 悬停标签
  const tip = getTips(fields)

  // 持久化 g 容器
  let g = svg.select('g.plot-content')
  if (g.empty()) {
    g = svg
      .append('g')
      .attr('class', 'plot-content')
      .attr('transform', `translate(${margin.left},${margin.top})`)
  }

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
  const t = svg.transition().duration(500)

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
    xAxis.tickValues(DF.xCategories.map((_, i) => i + 0.5)).tickFormat((_, i) => DF.xCategories[i])
  if (DF.yIsDis)
    yAxis.tickValues(DF.yCategories.map((_, i) => i + 0.5)).tickFormat((_, i) => DF.yCategories[i])
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

  svg.call(tip)

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
}

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
