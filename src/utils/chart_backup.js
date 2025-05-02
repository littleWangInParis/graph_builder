// src/utils/chart.js
/* 
 TODO 把 region 重构到 App.vue 中
 TODO clip-path + zoom
 TODO 选中效果时候 hover 没了
 TODO 拖出变量 + 文字不要遮挡拖拽区域
 TODO 拖拽调整大小

 */
 import * as d3 from "d3";
 import d3Tip from "d3-tip";
 import { DataFrame } from "./data";
 
 // 初始化图表（只调用一次）
 export function initChart(svgRef, width, height, margin) {
   const innerW = width - margin.left - margin.right;
   const innerH = height - margin.top - margin.bottom;
 
   const svg = d3.select(svgRef).attr("viewBox", [0, 0, width, height]);
 
   const g = svg.append("g").attr("class", "plot-config");
   // 大标题
   g.append("text")
     .attr("class", "chart-title")
     .attr("x", (width - margin.right + margin.left) / 2)
     .attr("y", margin.top / 2)
     .attr("text-anchor", "middle")
     .attr("font-size", 20)
     .attr("font-weight", "bold")
     .attr("fill", "#333")
     .text("");
 
   // 背景
   g.append("rect")
     .attr("x", margin.left)
     .attr("y", margin.top)
     .attr("width", innerW)
     .attr("height", innerH)
     .attr("fill", "white");
 
   // 拖拽提示
   g.append("text")
     .attr("class", "drag-hint")
     .attr("x", (2 * margin.left + innerW) / 2)
     .attr("y", (2 * margin.top + innerH) / 2)
     .attr("text-anchor", "middle")
     .text("Drag variables into drop zones");
 
   // 拖拽区域
   const s = 3;
   const widgetH = 50;
   const regions = [
     {
       name: "X",
       x: margin.left + s,
       y: height - margin.bottom + s,
       w: innerW - 2 * s,
       h: margin.bottom - 2 * s,
     },
     {
       name: "Y",
       x: s,
       y: margin.top + s,
       w: margin.left - 2 * s,
       h: innerH - 2 * s,
     },
     {
       name: "Color",
       x: width - margin.right + s,
       y: margin.top + s,
       w: margin.right - 2 * s,
       h: widgetH,
     },
     {
       name: "Size",
       x: width - margin.right + s,
       y: margin.top + widgetH + 2 * s,
       w: margin.right - 2 * s,
       h: widgetH,
     },
   ];
 
   const dragArea = g.append("g").attr("class", "drag-area");
 
   dragArea
     .selectAll("text.region-label")
     .data(regions)
     .enter()
     .append("text")
     .attr("class", (d) => `region-label region-label-${d.name}`)
     .attr("x", (d) => d.x + d.w / 2)
     .attr("y", (d) => d.y + d.h / 2)
     .attr("text-anchor", "middle")
     .attr("dominant-baseline", "middle")
     .attr("font-size", 18)
     .attr("font-weight", "bold")
     .attr("opacity", 0.2)
     .text((d) => d.name);
 
   dragArea
     .selectAll("rect.region")
     .data(regions)
     .enter()
     .append("rect")
     .attr("class", (d) => `region region-${d.name}`)
     .attr("x", (d) => d.x)
     .attr("y", (d) => d.y)
     .attr("rx", 5)
     .attr("width", (d) => d.w)
     .attr("height", (d) => d.h)
     .attr("fill", "transparent")
     .attr("stroke", "black")
     .attr("stroke-width", 1.5)
     .attr("stroke-opacity", 0.2)
     .on("dragover", (event) => event.preventDefault())
     .on("dragenter", (event, d) => {
       d3.select(event.target).attr("fill", "#ccc");
     })
     .on("dragleave", (event) => {
       d3.select(event.target).attr("fill", "transparent");
     })
     .on("drop", (event, d) => {
       d3.select(event.target).attr("fill", "transparent");
       const col = event.dataTransfer.getData("text/plain");
       if (d.name === "X") xFieldSetter(col);
       else if (d.name === "Y") yFieldSetter(col);
       else if (d.name === "Color") colorFieldSetter(col);
       else if (d.name === "Size") sizeFieldSetter(col);
     });
 }
 
 let xFieldSetter = () => {};
 let yFieldSetter = () => {};
 let colorFieldSetter = () => {};
 let sizeFieldSetter = () => {};
 
 // 注入 setter
 export function setFieldSetters({ setX, setY, setC, setS }) {
   xFieldSetter = setX;
   yFieldSetter = setY;
   colorFieldSetter = setC;
   sizeFieldSetter = setS;
 }
 
 // 更新图表并动画过渡
 export function updateChart(svgRef, data, fields, width, height, margin) {
   const svg = d3.select(svgRef);
   const [xField, yField, cField, sField] = fields;
 
   modifyPlotConfigs(svg, fields);
 
   // 悬停标签
   const tip = getTips(fields);
 
   const innerW = width - margin.left - margin.right;
   const innerH = height - margin.top - margin.bottom;
 
   // 持久化 g 容器
   let g = svg.select("g.plot-content");
   if (g.empty()) {
     g = svg
       .append("g")
       .attr("class", "plot-content")
       .attr("transform", `translate(${margin.left},${margin.top})`);
   }
 
   // 数据预处理
   const DF = new DataFrame(data, fields, 3, innerW, innerH);
   let plotData = DF.plotData;
   plotData = DF.addOffset(plotData);
 
   // 更新标题
   const supTitle =
     xField && yField ? `${yField} vs. ${xField}` : xField || yField || "";
   svg.select(".chart-title").text(supTitle);
 
   // 比例尺
   const xScale = d3
     .scaleLinear()
     .domain(DF.getRange("x"))
     .nice()
     .range([0, innerW]);
   const yScale = d3
     .scaleLinear()
     .domain(DF.getRange("y"))
     .nice()
     .range([innerH, 0]);
 
   // 过渡对象
   const t = svg.transition().duration(500);
 
   // 坐标轴（第一次创建后复用）
   let xAxisG = g.select("g.x.axis");
   if (xAxisG.empty()) {
     xAxisG = g
       .append("g")
       .attr("class", "x axis")
       .attr("transform", `translate(0,${innerH})`);
   }
   let yAxisG = g.select("g.y.axis");
   if (yAxisG.empty()) {
     yAxisG = g.append("g").attr("class", "y axis");
   }
 
   // 更新坐标轴
   const xAxis = d3.axisBottom(xScale);
   const yAxis = d3.axisLeft(yScale);
   if (DF.xIsDis)
     xAxis
       .tickValues(DF.xCategories.map((_, i) => i + 0.5))
       .tickFormat((_, i) => DF.xCategories[i]);
   if (DF.yIsDis)
     yAxis
       .tickValues(DF.yCategories.map((_, i) => i + 0.5))
       .tickFormat((_, i) => DF.yCategories[i]);
   xAxisG.call(xAxis);
   yAxisG.call(yAxis);
 
   // 轴标签
   let xlabel = xAxisG.select("text.axis-label");
   if (xlabel.empty()) {
     xlabel = xAxisG
       .append("text")
       .attr("class", "axis-label x-axis-label")
       .attr("x", innerW / 2)
       .attr("y", (margin.bottom * 2) / 3)
       .attr("text-anchor", "middle")
       .attr("font-size", 16)
       .attr("fill", "#333");
   }
   xlabel.text(xField);
 
   let ylabel = yAxisG.select("text.axis-label");
   if (ylabel.empty()) {
     ylabel = yAxisG
       .append("text")
       .attr("class", "axis-label y-axis-label")
       .attr("transform", "rotate(-90)")
       .attr("x", -innerH / 2)
       .attr("y", (-margin.left * 2) / 3)
       .attr("text-anchor", "middle")
       .attr("font-size", 16)
       .attr("fill", "#333");
   }
   ylabel.text(yField);
 
   d3.selectAll(".brush").remove()
   const brush = d3
     .brush()
     .extent([
       [0, 0],
       [innerW, innerH],
     ])
     .on("brush", ({ selection }) => {
       if (!selection) {
         gCircles.selectAll("circle.point").classed("selected", false);
         return;
       }
       const [[x0, y0], [x1, y1]] = selection;
 
       // 找出符合条件的点的 ._id
       const selectedIds = [];
       circles.each((d) => {
         const cx = xScale(d._x) + (DF.xIsDis && !DF.yIsDis ? d._offset : 0)
         const cy = yScale(d._y) + (DF.yIsDis && !DF.xIsDis ? d._offset : 0)
         if (x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1) {
           selectedIds.push(d._id);
         }
       });
       if (selectedIds.length === 0) {
         circles.classed("selected", false);
         circles.classed("unselected", false);
       } else {
         circles
           .classed("selected", (d) => selectedIds.includes(d._id))
           .classed("unselected", (d) => !selectedIds.includes(d._id));
       }
     })
     .on("end", (event) => {
       if (event.selection !== null) {
         console.log(event);
 
         // 去掉 brush 的框，并把 selection 设置为 null
         brushG.call(d3.brush().move, null);
       }
     });
 
   // 2. 添加 brush 容器
   const brushG = g.append("g").attr("class", "brush").call(brush);
   brushG.lower()
 
   let gCircles = g.select("g.circles");
 
   // 初始化才执行
   if (gCircles.empty()) {
     gCircles = g.append("g").attr("class", "circles");
   }
   console.log(gCircles);
 
   const circles = gCircles
     .selectAll("circle.point")
     .data(plotData)
     .join(
       // Enter
       (enter) =>
         enter
           .append("circle")
           .attr("class", "point")
           .attr(
             "cx",
             (d) => xScale(d._x) + (DF.xIsDis && !DF.yIsDis ? d._offset : 0)
           )
           .attr(
             "cy",
             (d) => yScale(d._y) + (DF.yIsDis && !DF.xIsDis ? d._offset : 0)
           )
           .attr("r", 0)
           .attr("fill", (d) => d._color)
           .transition(t)
           .attr("r", (d) => d._size),
       // Update
       (update) =>
         update
           .transition(t)
           // .delay((d, i) => i * 0.5) // 如果需要延迟动画
           .attr(
             "cx",
             (d) => xScale(d._x) + (DF.xIsDis && !DF.yIsDis ? d._offset : 0)
           )
           .attr(
             "cy",
             (d) => yScale(d._y) + (DF.yIsDis && !DF.xIsDis ? d._offset : 0)
           )
           .attr("r", (d) => d._size)
           .attr("fill", (d) => d._color),
 
       // Exit
       (exit) => exit.transition(t).attr("r", 0).remove()
     )
     .on("mouseover", tip.show)
     .on("mouseout", tip.hide);
 
   svg.call(tip);
 }
 
 function modifyPlotConfigs(svg, fields) {
   const [xField, yField, cField, sField] = fields;
   // 隐藏提示
   if (cField || xField || yField || sField) {
     svg.select(".drag-hint").attr("display", "none");
   }
   // 更新标签
   if (cField) svg.select(".region-label-Color").text(`color: ${cField}`);
   if (sField) svg.select(".region-label-Size").text(`size: ${sField}`);
   if (xField)
     svg.select(".region-X").attr("stroke-width", 0),
       svg.select(".region-label-X").text("");
   if (yField)
     svg.select(".region-Y").attr("stroke-width", 0),
       svg.select(".region-label-Y").text("");
 }
 
 function getTips(fields) {
   d3.selectAll(".d3-tip").remove();
   const [xField, yField, cField, sField] = fields;
   return d3Tip()
     .attr("class", "d3-tip")
     .offset([-5, 0])
     .html(function (event, d) {
       let hoverToolTips = "<table>";
       if (xField)
         hoverToolTips += `<tr><td class="name">${xField}</td><td>: ${d.x}</td></tr>`;
       if (yField)
         hoverToolTips += `<tr><td class="name">${yField}</td><td>: ${d.y}</td></tr>`;
       if (cField)
         hoverToolTips += `<tr><td class="name">${cField}</td><td>: ${d.color}</td></tr>`;
       if (sField)
         hoverToolTips += `<tr><td class="name">${sField}</td><td>: ${d.size}</td></tr>`;
       hoverToolTips += "</table>";
       return hoverToolTips;
     });
 }
 