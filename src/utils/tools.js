import * as d3 from "d3";

export function getMaxOverlapFromMap(offsetMap) {
  let maxCount = 0;
  Object.values(offsetMap).forEach(yGroups => {
    Object.values(yGroups).forEach(group => {
      maxCount = Math.max(maxCount, group.length);
    });
  });
  return maxCount;
}

export function calculateDomain(extent, padding) {
  const range = (extent[1] - extent[0]) * padding;
  return [extent[0] - range, extent[1] + range];
}