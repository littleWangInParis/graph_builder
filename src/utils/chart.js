// src/utils/chart.js
/* 
 TODO 拖出变量
 TODO 拖拽调整大小
 */
import * as d3 from 'd3'
import d3Tip from 'd3-tip'
import { DataFrame } from './data'

export const brushDispatcher = d3.dispatch('brush')

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

  // 绘制直方图的底纹
}

export class PlotLauncher {
  constructor(container, innerW, innerH, margin, chartID, xAxisVis = false, yAxisVis = false) {
    this.margin = margin
    const width = innerW + margin.left + margin.right
    const height = innerH + margin.top + margin.bottom
    this.innerW = innerW
    this.innerH = innerH
    this.chartID = chartID
    this.xAxisVis = xAxisVis
    this.yAxisVis = yAxisVis

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

    this.plotContent
      .append('line')
      .attr('class', 'border-line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', this.innerW)
      .attr('y2', 0)

    this.plotContent
      .append('line')
      .attr('class', 'border-line')
      .attr('x1', this.innerW)
      .attr('y1', 0)
      .attr('x2', this.innerW)
      .attr('y2', this.innerH)

    this.yScale = null
    this.xScale = null
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
