import * as d3 from 'd3'

export function getMaxOverlapFromMap(offsetMap) {
  let maxCount = 0
  Object.values(offsetMap).forEach(yGroups => {
    Object.values(yGroups).forEach(group => {
      maxCount = Math.max(maxCount, group.length)
    })
  })
  return maxCount
}

export function calculateDomain(extent, padding) {
  const range = (extent[1] - extent[0]) * padding
  return [extent[0] - range, extent[1] + range]
}

export function calculateMaxBins(allXFields, data, innerW) {
  // 计算所有变量的直方图 bins 的最大 bin count 的最大值
  let yMax = -1

  allXFields.forEach(field => {
    const values = data.value.map(d => +d[field])
    const xScale = d3.scaleLinear().domain(d3.extent(values)).nice().range([0, innerW])

    const thresholds = xScale.ticks(12)

    const binGenerator = d3
      .bin()
      .domain(d3.extent(values))
      .thresholds(thresholds)

    const bins = binGenerator(values)
    const maxBinCount = d3.max(bins, d => d.length)

    if (maxBinCount > yMax) {
      yMax = maxBinCount
    }
  })

  return yMax * 1.05
}
