import * as d3 from "d3";
import { calculateDomain, getMaxOverlapFromMap } from "./tools";

// 判断是否为离散型
export const isDiscrete = (arr) => {
  const vals = arr.filter((v) => v != null && v !== "");
  return !(vals.length > 0 && vals.every((v) => !isNaN(+v)));
};

export class DataFrame {
  constructor(data, fields, radius, innerW, innerH) {
    [this.xField, this.yField, this.cField, this.sField] = fields;
    this.radius = radius;
    this.originData = data;
    this.width = innerW;
    this.height = innerH;
    this.plotData = this.preprocessData();
  }

  preprocessData() {
    // map 取出某一列
    const xRaw = this.originData.map((d) => d[this.xField]);
    const yRaw = this.originData.map((d) => d[this.yField]);
    const cRaw = this.originData.map((d) => d[this.cField]);
    const sRaw = this.originData.map((d) => d[this.sField]);

    this.xIsDis = isDiscrete(xRaw);
    this.yIsDis = isDiscrete(yRaw);
    this.cIsDis = isDiscrete(cRaw);
    this.sIsDis = isDiscrete(sRaw);

    if (this.xIsDis) {
      // 先把 null/"" 也映射成一个 key，再去重
      this.xCategories = Array.from(
        new Set(xRaw.map((v) => (v == null || v === "" ? "" : String(v))))
      );
    }
    if (this.yIsDis) {
      this.yCategories = Array.from(
        new Set(yRaw.map((v) => (v == null || v === "" ? "" : String(v))))
      );
    }

    let colorScale;
    if (this.cField) {
      if (this.cIsDis) {
        // 分类：用离散颜色
        const categories = Array.from(new Set(cRaw));
        colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(categories);
        this.cCategories = categories
      } else {
        // 数值：用连续色带
        const extent = d3.extent(cRaw, (v) => +v);
        colorScale = d3.scaleSequential(d3.interpolateViridis).domain(extent);
      }
    } else {
      // 没有 cField 就是黑色
      colorScale = d3.scaleOrdinal().range(["black"]);
    }
    this.colorScale = colorScale;  

    let sizeScale;
    if (this.sField && !this.sIsDis) {
      const extent = d3.extent(sRaw, (v) => +v);
      sizeScale = d3
        .scaleSqrt()
        .domain(extent)
        .range([this.radius / 2, this.radius * 2]);
    } else {
      sizeScale = d3.scaleOrdinal().range([this.radius]);
    }

    // 用于给离散值／空值编码：第一次碰到某个 key 就给它一个序号
    const makeEncoder = () => {
      const map = new Map();
      return (v) => {
        const key = v == null || v === "" ? "__missing__" : String(v);
        if (!map.has(key)) map.set(key, map.size);
        // map.size 从 1 开始，但取到 index 0 时 size=1 -> 我们要用 0.5；index 1 -> 1.5…
        return map.get(key) + 0.5;
      };
    };

    const encodeX = makeEncoder();
    const encodeY = makeEncoder();

    // 生成绘图数组
    const plotData = this.originData.map((d, i) => ({
      _id: i,
      _x: !this.xIsDis ? +d[this.xField] : encodeX(d[this.xField]),
      _y: !this.yIsDis ? +d[this.yField] : encodeY(d[this.yField]),
      _color: colorScale(d[this.cField]),
      _size: sizeScale(d[this.sField]),
      x: d[this.xField],
      y: d[this.yField],
      color: d[this.cField],
      size: d[this.sField],
    }));

    return plotData;
  }

  getRange(axis) {
    if (axis === "x") {
      const xVals = this.plotData.map((d) => d._x);
      if (this.xIsDis) {
        return [0, d3.max(xVals) + 0.5];
      } else {
        return calculateDomain(d3.extent(xVals), 0.05);
      }
    } else {
      const yVals = this.plotData.map((d) => d._y);
      if (this.yIsDis) {
        return [0, d3.max(yVals) + 0.5];
      } else {
        return calculateDomain(d3.extent(yVals), 0.05);
      }
    }
  }

  /*
    如果 X 离散、Y 连续，就对同一 (._x, ._y) 组内按 index 分配 offset
    反之同理
  */
  addOffset(data) {
    if (this.xIsDis && !this.yIsDis) {
      const offsetMap = {};
      /* 
        把同一 x 对应的同一 y 的数据点聚集在一起
        形成 { xValue: { yValue: [d1, d2, …], … }, … } 的嵌套结构
      */
      data.forEach((d) => {
        offsetMap[d._x] = offsetMap[d._x] || {};
        offsetMap[d._x][d._y] = offsetMap[d._x][d._y] || [];
        offsetMap[d._x][d._y].push(d);
      });

      const maxCount = getMaxOverlapFromMap(offsetMap);
      const maxCircleInterval =
        ((this.width / this.xCategories.length) * 0.8) / maxCount / 2;
      const newRadius = Math.min(this.radius, maxCircleInterval);

      Object.values(offsetMap).forEach((yGroups) =>
        Object.values(yGroups).forEach((group) =>
          /*
            group 是所有同 x 同 y 组成的点的数组
            group = [
              {...},
              {...},
              {...}
            ]
            接下来遍历 group
          */
          group.forEach((d, i) => {
            d._offset =
              // 若奇数个，要以 0 为中心
              group.length % 2 !== 0
                ? (i - Math.floor(group.length / 2)) * newRadius * 2
                : newRadius - newRadius * group.length + 2 * newRadius * i;
          })
        )
      );
    }

    if (this.yIsDis && !this.xIsDis) {
      const offsetMap = {};
      data.forEach((d) => {
        offsetMap[d._y] = offsetMap[d._y] || {};
        offsetMap[d._y][d._x] = offsetMap[d._y][d._x] || [];
        offsetMap[d._y][d._x].push(d);
      });

      const maxCount = getMaxOverlapFromMap(offsetMap);
      const maxCircleInterval =
        ((this.height / this.yCategories.length) * 0.8) / maxCount / 2;
      const newRadius = Math.min(this.radius, maxCircleInterval);

      Object.values(offsetMap).forEach((xGroups) =>
        Object.values(xGroups).forEach((group) =>
          group.forEach((d, i) => {
            d._offset =
              group.length % 2 !== 0
                ? (i - Math.floor(group.length / 2)) * newRadius * 2
                : newRadius - newRadius * group.length + 2 * newRadius * i;
          })
        )
      );
    }

    return data;
  }
}
