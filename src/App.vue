<template>
  <div class="container">
    <div class="left-div">
      <aside class="sidebar">
        <h1>Graph Builder</h1>
        <p style="padding: 10px 0">Dataset: {{ datasetName }}</p>
        <ul>
          <li v-for="col in columnInfo" :key="col.name" draggable="true" @dragstart="onDragStart($event, col.name)"
            class="col-item">
            <ChartNoAxesColumn v-if="col.isDiscrete" :size="typeMarkerSize" stroke-width="3" stroke="#a52420"
              class="icon-continous" />
            <ChartNoAxesCombined v-else :size="typeMarkerSize" stroke-width="2" stroke="#4c4b99"
              class="icon-discrete" />
            <span>{{ col.name }}</span>
          </li>
        </ul>
      </aside>
    </div>
    <div class="middle-div">
      <div id="chart-types">
        <ChartScatter :size="plotIconSize" stroke-width="1.5" :stroke="typeMarkerStroke" class="chart-icon"
          @click="changeSelectedChart('scatter')"
          :class="['chart-icon', { 'chart-icon--active': selectedChart === 'scatter' }]" />
        <ChartColumn :size="plotIconSize" stroke-width="1.5" :stroke="typeMarkerStroke" class="chart-icon"
          @click="changeSelectedChart('histogram')"
          :class="['chart-icon', { 'chart-icon--active': selectedChart === 'histogram' }]" />
        <ChartCandlestick :size="plotIconSize" stroke-width="1.5" :stroke="typeMarkerStroke" class="chart-icon"
          @click="changeSelectedChart('box')"
          :class="['chart-icon', { 'chart-icon--active': selectedChart === 'box' }]" />
        <ChartLine :size="plotIconSize" stroke-width="1.5" :stroke="typeMarkerStroke" class="chart-icon"
          @click="changeSelectedChart('line')"
          :class="['chart-icon', { 'chart-icon--active': selectedChart === 'line' }]" />
      </div>
      <div id="plot-area">
        <svg ref="svg" :width="outerW" :height="outerH" id="plot-svg"></svg>
        <table id="plot-matrix"></table>
        <div id="plot-configs">
          <div class="left-config">
            <div class="region region-Y" :style="regionYStyle" @dragover.prevent @dragenter="highlight($event)"
              @dragleave="unhighlight($event)" @drop="handleDrop($event, 'Y')">
              <span class="rt rt-Y">Y</span>
            </div>
          </div>
          <div class="middle-config">
            <div class="chart-title" :style="titleStyle">
              <h2 class="sup-title"></h2>
            </div>

            <div class="region region-X" :style="regionXStyle" @dragover.prevent @dragenter="highlight($event)"
              @dragleave="unhighlight($event)" @drop="handleDrop($event, 'X')">
              <span class="rt rt-X">X</span>
            </div>
          </div>
          <div class="right-config">
            <div class="region region-C" :style="regionRightStyle" @dragover.prevent @dragenter="highlight($event)"
              @dragleave="unhighlight($event)" @drop="handleDrop($event, 'C')">
              <span class="rt rt-C">Color</span>
            </div>
            <div class="region region-S" :style="regionRightStyle" @dragover.prevent @dragenter="highlight($event)"
              @dragleave="unhighlight($event)" @drop="handleDrop($event, 'S')">
              <span class="rt rt-S">Size</span>
            </div>
          </div>
        </div>

      </div>
    </div>
    <div class="table-div">
      <table id="data-table">

      </table>
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted, watch, computed } from 'vue';
  import * as d3 from 'd3';
  import { ChartScatter, ChartLine, ChartColumn, ChartCandlestick, ChartNoAxesColumn, ChartNoAxesCombined } from 'lucide-vue-next';

  import { isDiscrete, loadDataTable } from './utils/data.js'

  import { initGraphBuilder } from '@/utils/chart.js';

  import { calculateMaxBins } from '@/utils/tools.js'

  import { ScatterPlot } from '@/utils/plotting/scatter.js'

  import { HistogramPlot } from '@/utils/plotting/histogram.js'

  /**
   * 初始化参数
   * @param data 原始数据数组
   * @param innerW 绘图区域宽度
   * @param innerH 绘图区域高度
   * @param outerW 包括配置区域在内的宽度
   * @param outerH 包括配置区域在内的高度
   * @param s 配置区域的间隙大小
   * @param widgetH 配置组件的宽度
   * @param svg 配置白色背景板的 svg
   */

  const datasetName = "explore.csv";
  const margin = { top: 50, right: 150, bottom: 60, left: 60 };
  const innerW = 750;
  const innerH = 750;
  const outerW = innerW + margin.left + margin.right
  const outerH = innerH + margin.top + margin.bottom
  const s = 3
  const widgetH = 50
  const plotIconSize = 36
  const typeMarkerSize = 28
  const typeMarkerStroke = "dimgrey"

  const columns = ref([]);
  const data = ref([]);
  const selectedChart = ref('scatter')
  const xFields = ref([]);
  const yFields = ref([]);
  const cField = ref('');
  const sField = ref('');
  const svg = ref(null);
  // const pl = ref(null)

  let chartId = 0

  onMounted(async () => {
    const raw = await d3.csv('/dataset/explore_more.csv', d3.autoType);
    // const raw = await d3.csv('/dataset/apple_cleaned.csv', d3.autoType);
    // const raw = await d3.csv('/dataset/large_dataset.csv', d3.autoType);

    data.value = raw;
    columns.value = raw.columns || Object.keys(raw[0] || {});
    initGraphBuilder(svg.value, innerW, innerH, outerW, outerH, margin)
    loadDataTable(raw)
    // pl.value = new PlotLauncher(svg.value, outerW, outerH, margin, 1)

  });

  function highlight(event) {
    // 用 d3 设置 style 的优先级很高，推荐用 css class 来配置样式
    d3.select(event.target).classed("region-hover", true);
  }

  function unhighlight(event) {
    d3.select(event.target).classed("region-hover", false);
  }

  function handleDrop(event, name) {
    const col = event.dataTransfer.getData("text/plain");
    if (name === "X") {
      xFields.value.push(col);
      d3.select(".region-X").classed("region-hidden", true)
    }
    else if (name === "Y") {
      yFields.value.push(col);
      d3.select(".region-Y").classed("region-hidden", true)
    }
    else if (name === "C") {
      cField.value = col;
      d3.select(".rt-C").text(`Color: ${col}`)
    }
    else if (name === "S") {
      sField.value = col;
      d3.select(".rt-S").text(`Size: ${col}`)
    }

    d3.select('.drag-hint').attr('display', 'none')
    d3.select(event.target).classed("region-hover", false);
  }

  // 监听字段变化，更新图表
  watch([xFields, yFields, cField, sField, selectedChart], ([newX, newY, newC, newS, newChart], [oldX, oldY, oldC, oldS, oldChart]) => {
    const cChanged = newC !== oldC
    const sChanged = newS !== oldS

    const xNum = Math.max(xFields.value.length, 1)
    const yNum = Math.max(yFields.value.length, 1)
    const subInnerW = innerW / xNum
    const subInnerH = innerH / yNum

    const plotMatrix = d3.select("#plot-matrix")
    plotMatrix.html('')

    d3.selectAll('.d3-tip').remove()

    let yMax
    if (selectedChart.value == "histogram") {
      yMax = calculateMaxBins(xFields.value, data, subInnerW)
    }
    for (let j = 0; j < yNum; j++) {
      const row = plotMatrix.append('tr');
      for (let i = 0; i < xNum; i++) {
        // 每个单元格
        const cell = row.append('td').style('padding', '0');
        // 计算子图的 margin
        const subMargin = {
          top: 0,
          left: i == 0 ? 60 : 0,
          bottom: j == yNum - 1 ? 60 : 0,
          right: 0
        };

        // 可见只在第一行／第一列显示坐标轴
        const xAxisVis = j === yNum - 1;
        const yAxisVis = i === 0;

        // 根据选中的 chart 类型调用绘图
        const fields = [xFields.value[i], yFields.value[j], cField.value, sField.value];
        if (selectedChart.value === 'scatter') {
          const pl = new ScatterPlot(
            cell.node(),
            subInnerW,
            subInnerH,
            subMargin,
            chartId++,
            xAxisVis,
            yAxisVis
          );
          pl.draw(data.value, fields);
        } else {
          const pl = new HistogramPlot(
            cell.node(),
            subInnerW,
            subInnerH,
            subMargin,
            chartId++,
            xAxisVis,
            yAxisVis
          );
          pl.draw(data.value, [xFields.value[i]], yMax);
        }
      }
    }
  }, { deep: true });

  function onDragStart(event, col) {
    event.dataTransfer.setData('text/plain', col);
  }

  function changeSelectedChart(type) {
    selectedChart.value = type
  }

  const columnInfo = computed(() => columns.value.map((name) => {
    const arr = data.value.map(d => d[name])
    return {
      name: name,
      isDiscrete: isDiscrete(arr)
    }
  })
  )
  const regionYStyle = computed(() => ({
    margin: s + 'px',
    marginTop: margin.top + s + 'px',
    width: margin.left - 2 * s + 'px',
    height: innerH - 2 * s + 'px'
  }))

  const regionXStyle = computed(() => ({
    margin: s + 'px',
    width: innerW - 2 * s + 'px',
    height: margin.bottom - 2 * s + 'px',
  }))

  const titleStyle = computed(() => ({
    height: margin.top + 'px',
    width: innerW + 'px',
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    // 把 region-X 往下顶
    marginBottom: innerH + s + 'px'
  }))

  const regionRightStyle = computed(() => ({
    height: widgetH + 'px',
    width: margin.right + 'px',
    margin: s + 'px',
  }))

  const regionHintStyle = computed(() => ({
    backgroundColor: "white",
    height: innerH + 'px',
    width: innerW + 'px',
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  }))
</script>

<style>

  * {
    padding: 0;
    margin: 0;
  }

  .container {
    display: flex;
    font-family: Arial;
    height: 100vh;
    overflow-x: auto;
  }

  h1 {
    padding-bottom: 10px;
    background: linear-gradient(90deg, #5C6BC0, #EF5350);
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 3px 3px 2px rgba(0, 0, 0, 0.1);
  }

  .left-div {
    box-shadow: 10px 0 10px rgba(0, 0, 0, 0.05);
    z-index: 1;
  }

  .sidebar {
    /* 这样窗口缩小元素也不会小 */
    min-width: 180px;
    flex: 0 0 10%;
    /* border-right: 1px solid #ccc; */
    padding: 10px;
    height: 100%;
    background-color: white;
    resize: both;
  }

  .sidebar ul {
    list-style: none;
    padding: 0;
  }

  .sidebar li {
    display: flex;
    padding: 4px;
    margin: 4px 0;
    background: #f5f5f5;
    cursor: grab;
    /* text-align: center; */
    align-items: center;
    gap: 10px;
    border-radius: 10px;
    transition: background-color 0.5s ease;
  }

  .sidebar li:hover {
    background-color: white;
  }

  .sidebar li span {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chart-icon {
    transition:
      stroke 0.5s ease,
      stroke-width 0.5s ease;

  }

  .chart-icon:hover {
    stroke: #333;
    stroke-width: 2;
    cursor: pointer;
    background-color: white;
  }

  .chart-icon--active {
    stroke: #333;
    stroke-width: 2;
    background-color: white;
  }

  .middle-div {
    /* flex: 1; */
    padding: 10px 40px;
    background-color: #f5f5f5;
    min-width: 1000px;
    flex: 0 0 50%;
  }

  #plot-area {
    position: relative;
  }

  /* plot-config & plot-svg 使用绝对定位 这样他们会重叠 */
  #plot-configs {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    pointer-events: none;
  }

  #plot-svg {
    position: absolute;
    top: 0;
    left: 0;
  }

  .region {
    box-sizing: border-box;
    background-color: transparent;
    border: 1.5px solid rgba(0, 0, 0, 0.2);
    border-radius: 5px;
    display: flex;
    /* 文本居中用 */
    align-items: center;
    justify-content: center;
    pointer-events: auto;

  }

  .region-hover {
    background-color: #ccc;
    border: 1.5px solid rgba(0, 0, 0, 0.2) !important;
  }

  .region-hidden {
    border: none;
    background-color: transparent;
  }

  .region-hidden span {
    visibility: hidden;
  }

  .rt {
    font-size: 18px;
    font-weight: bold;
    opacity: 0.2;
    pointer-events: none;
    /* 让拖拽事件透过文字生效 */
    user-select: none;
  }

  .drag-hint {
    font-size: 32px;
    font-weight: bold;
    opacity: 0.2;
  }

  h2.sup-title {
    color: #333;
    font-size: 20px;
    font-weight: bold;
  }

  .border-line {
    stroke-width: 1;
    stroke: #ccc;
  }

  #plot-matrix {
    transform: translate(0, 50px);
    border-collapse: collapse;
  }

  #plot-matrix svg {
    display: block;
  }

  .d3-tip {
    background-color: white;
    padding: 10px;
    border-radius: 10px;
    box-shadow: 5px 5px 10px -5px grey;
    font-size: 14px;
  }

  .d3-tip td.name {
    font-weight: bold;
    text-align: right;
  }

  .brush .selection {
    fill: none;
    stroke: #333;
    stroke-width: 1
  }

  circle.point.unselected {
    opacity: 0.1;
  }

  circle.point.selected {
    opacity: 1;
  }

  #hist-stripes rect {
    fill: #7986CB;
  }

  #hist-stripes line {
    stroke: #5C6BC0;
    stroke-width: 2
  }

  .bar {
    fill: #dde0f0;
    stroke: #333;
  }

  .bar-selected {
    fill: url(#hist-stripes);
    stroke: #333;
  }

  .table-div {
    flex: 1;
    /* 等价于 flex: 1 1 0 */
    min-width: 400px;
    background: #fff;
    overflow: auto;
    box-shadow: -10px 0 10px rgba(0, 0, 0, 0.05);
    z-index: 1;
  }

  #data-table {
    border-collapse: collapse;
    margin: 0;
    /* 原来只有 margin-left:0 */
    max-height: 100vh;
  }

  /* 表头 & 单元格 基础样式 */
  #data-table th,
  #data-table td {
    padding: 9px;
    text-align: center;
    border-bottom: 1px solid #ccc;
    white-space: nowrap;
    /* transition: background-color .1s ease, color .1s ease; */
  }

  /* 表头单独样式 */
  #data-table th {
    background: #f5f5f5;
    border: none;
  }

  /* 固定首列 & 表头 */
  #data-table th:first-child,
  #data-table td:first-child {
    position: sticky;
    left: 0;
    background: #f5f5f5;
    color: #333;
    z-index: 1;
    font-weight: bold;
  }

  /* 固定表头 */
  #data-table thead {
    position: sticky;
    top: 0;
    z-index: 2;
  }

  /* 鼠标悬停高亮 */
  #data-table tr:hover td {
    background: #ccc;
    color: #333;
  }

  /* 选中行高亮 */
  #data-table tr.selected td {
    background: #7986CB;
    color: #fff;
  }

  #data-table tr.selected th:first-child,
  #data-table tr.selected td:first-child {
    background-color: #5C6BC0;
  }
</style>
