<template>
  <div class="container">
    <aside class="sidebar">
      <h1>Graph Builder</h1>
      <p style="padding: 10px 0">Dataset: {{ datasetName }}</p>
      <ul>
        <li v-for="col in columnInfo" :key="col.name" draggable="true" @dragstart="onDragStart($event, col.name)"
          class="col-item">
          <ChartNoAxesColumn v-if="col.isDiscrete" :size="typeMarkerSize" stroke-width="3" stroke="#a52420"
            class="icon-continous" />
          <ChartNoAxesCombined v-else :size="typeMarkerSize" stroke-width="2" stroke="#4c4b99" class="icon-discrete" />
          <span>{{ col.name }}</span>
        </li>
      </ul>
    </aside>
    <div class="right-div">
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
  </div>
</template>

<script setup>
  import { ref, onMounted, watch, computed } from 'vue';
  import * as d3 from 'd3';
  import { ChartScatter, ChartLine, ChartColumn, ChartCandlestick, ChartNoAxesColumn, ChartNoAxesCombined } from 'lucide-vue-next';

  import { isDiscrete } from './utils/data.js'

  import { initGraphBuilder, PlotLauncher } from '@/utils/chart.js';

  const datasetName = "explore.csv";
  const margin = { top: 50, right: 150, bottom: 60, left: 60 };
  const svgMargin = { top: 50, right: 0, bottom: 60, left: 60 };
  const innerW = 650;
  const innerH = 650;
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
  const xField = ref('');
  const yField = ref('');
  const cField = ref('');
  const sField = ref('');
  const svg = ref(null);
  const pl = ref(null)

  let subW = innerW + margin.left + margin.right
  let subH = innerH + margin.top + margin.bottom

  onMounted(async () => {
    const raw = await d3.csv('/dataset/explore_more.csv', d3.autoType);
    // const raw = await d3.csv('/dataset/apple_cleaned.csv', d3.autoType);
    // const raw = await d3.csv('/dataset/large_dataset.csv', d3.autoType);

    data.value = raw;
    columns.value = raw.columns || Object.keys(raw[0] || {});
    initGraphBuilder(svg.value, innerW, innerH, outerW, outerH, margin)
    
    pl.value = new PlotLauncher(svg.value, subW, subH, margin, 1)
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
      xField.value = col;
      d3.select(".region-X").classed("region-hidden", true)
    }
    else if (name === "Y") {
      yField.value = col;
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
  watch([xField, yField, cField, sField, selectedChart], () => {
    const fields = [xField.value, yField.value, cField.value, sField.value]
    if (selectedChart.value == "scatter") {
      pl.value.drawScatter(data.value, fields);
    } else if (selectedChart.value == "histogram") {
      pl.value.drawHistogram(data.value, [xField.value])
    }
  });

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
  }

  h1 {
    padding-bottom: 10px;
  }

  .sidebar {
    /* 这样窗口缩小元素也不会小 */
    min-width: 180px;
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
    stroke: black;
    stroke-width: 2;
    cursor: pointer;
    background-color: white;
  }

  .chart-icon--active {
    stroke: black;
    stroke-width: 2;
    background-color: white;
  }

  .right-div {
    flex: 1;
    padding: 10px 40px;
    background-color: #f5f5f5;
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
    /* background-color: azure; */
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
    opacity: 0.2;
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
</style>
