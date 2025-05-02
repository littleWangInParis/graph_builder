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
    <div class="right-area">
      <div id="chart-types">
        <ChartScatter :size="plotIconSize" stroke-width="1.5" :stroke="typeMarkerStroke" class="chart-icon" />
        <ChartLine :size="plotIconSize" stroke-width="1.5" :stroke="typeMarkerStroke" class="chart-icon" />
        <ChartColumn :size="plotIconSize" stroke-width="1.5" :stroke="typeMarkerStroke" class="chart-icon" />
        <ChartCandlestick :size="plotIconSize" stroke-width="1.5" :stroke="typeMarkerStroke" class="chart-icon" />
      </div>
      <div id="main-plot">
        <svg ref="svg" :width="width" :height="height" id="plot-area">
        </svg>
      </div>

    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted, watch, computed } from 'vue';
  import * as d3 from 'd3';
  import { ChartScatter, ChartLine, ChartColumn, ChartCandlestick, ChartNoAxesColumn, ChartNoAxesCombined } from 'lucide-vue-next';

  import { isDiscrete } from './utils/data.js'

  import {
    initChart,
    updateChart,
    setFieldSetters
  } from '@/utils/chart.js';

  const datasetName = "explore.csv";
  const margin = { top: 50, right: 150, bottom: 60, left: 60 };
  const width = 650 + margin.left + margin.right;
  const height = 650 + margin.top + margin.bottom;
  const plotIconSize = 36
  const typeMarkerSize = 28
  const typeMarkerStroke = "dimgrey"

  const columns = ref([]);
  const data = ref([]);
  const xField = ref('');
  const yField = ref('');
  const cField = ref('');
  const sField = ref('');
  const svg = ref(null);

  // 把组件的字段 setter 注入到模块中
  setFieldSetters({
    setX: col => xField.value = col,
    setY: col => yField.value = col,
    setC: col => cField.value = col,
    setS: col => sField.value = col
  });

  onMounted(async () => {
    const raw = await d3.csv('/dataset/explore_more.csv', d3.autoType);
    data.value = raw;
    columns.value = raw.columns || Object.keys(raw[0] || {});
    initChart(svg.value, width, height, margin);
  });

  const columnInfo = computed(() => columns.value.map((name) => {
    const arr = data.value.map(d => d[name])
    return {
      name: name,
      isDiscrete: isDiscrete(arr)
    }
  })
  )

  // 监听字段变化，更新图表
  watch([xField, yField, cField, sField], () => {
    updateChart(svg.value, data.value, [xField.value, yField.value, cField.value, sField.value], width, height, margin);
  });

  function onDragStart(event, col) {
    event.dataTransfer.setData('text/plain', col);
  }
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

  .right-area {
    flex: 1;
    padding: 10px 40px;
    background-color: #f5f5f5;
  }

  .drag-hint {
    font-size: 32px;
    font-weight: bold;
    opacity: 0.2;
    text-anchor: middle;
    dominant-baseline: middle;
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
</style>
