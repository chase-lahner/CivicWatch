import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

export const LegislatorHeatMap = ({ height = 600, width = 1000, data, legScatterData, setLegislatorClicked }) => {
  const margin = { top: 50, right: 30, bottom: 50, left: 159 };
  const svgRef = useRef(null);
  const [rowHeight] = useState(20);
  const [totalHeight, setTotalHeight] = useState(height);

  const handleClick = (name) => {
    setLegislatorClicked((legScatterData.filter((d) => d.name === name)));
  }

  useEffect(() => {
    if (!data?.legislators?.length) return;

    // Calculate needed height
    const neededHeight = margin.top + margin.bottom + (data.legislators.length * rowHeight);
    setTotalHeight(neededHeight);

    // Process data
    const allMonths = new Set();
    const processedData = data.legislators.map(legislator => {
      const months = Object.entries(legislator.monthly_post_counts)
        .map(([monthStr, count]) => {
          const date = d3.timeParse("%Y-%m")(monthStr);
          if (date) allMonths.add(date);
          return { date, count, monthStr};
        })
        .filter(d => d.date);
      return { ...legislator, months };
    });

    

    // Create scales
    const monthArray = Array.from(allMonths).sort((a, b) => a - b);
    const names = processedData.map(d => d.name);

    const allDates = d3.timeMonths(
      d3.min(data.legislators.flatMap(d =>
        Object.keys(d.monthly_post_counts).map(monthStr => d3.timeParse("%Y-%m")(monthStr))
      )),
      d3.timeMonth.offset(
        d3.max(data.legislators.flatMap(d =>
          Object.keys(d.monthly_post_counts).map(monthStr => d3.timeParse("%Y-%m")(monthStr))
        )),
        1
      )
    );

    const x = d3.scaleBand()
      .domain(monthArray)
      .range([margin.left, width - margin.right])
      .padding(0.05);

    const y = d3.scaleBand()
      .domain(names)
      .range([margin.top, neededHeight - margin.bottom])
      .padding(0.2);
    
      const maxPostedCount = d3.max(data.legislators.flatMap(d =>
        Object.values(d.monthly_post_counts)
      ));

    const maxCount = d3.max(processedData.flatMap(d => d.months.map(m => m.count)));
    const postCounts = data.legislators.flatMap(d => Object.values(d.monthly_post_counts));
    const q95 = d3.quantile(postCounts.sort(d3.ascending), 0.95); // 95th percentile
    
    // Create a nonlinear color scale focused on typical values
    const color = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, q95 * 0.3, q95]) // 30% of 95th percentile as mid-point
      .unknown("#f8f8f8"); // Very light gray for zeros
      

    // Clear and setup SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr("width", width)
       .attr("height", Math.min(neededHeight, height))
       .attr("viewBox", `0 0 ${width} ${neededHeight}`)
       .attr("preserveAspectRatio", "none");

    const g = svg.append("g");

    // X-axis
    g.append("g")
      .attr("transform", `translate(0,${margin.top})`)
      .call(d3.axisTop(x).tickFormat(d3.timeFormat("%b %Y")))
      .selectAll("text")
      .attr("y", 0)
      .attr("x", 9)
      .attr("dy", ".35em")
      .attr("transform", "rotate(-60)")
      .style("text-anchor", "start");

    // Y-axis
    const yAxis = g.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));
    
      
    
    yAxis.selectAll(".tick text")
      .style("font-size", "12px")
      .style("cursor", "pointer")
      .style("fill", "ffffff")
      .on("click", function (event, legislatorName) {
        setLegislatorClicked(legScatterData.filter((d) => d.name === legislatorName))
      })

    

    // Heatmap cells
    const cellGroups = g.selectAll(".legislator")
      .data(processedData)
      .join("g")
      .attr("class", "legislator")
      .attr("transform", d => `translate(0,${y(d.name)})`);

      cellGroups.selectAll("rect")
      .data(d => allDates.map(date => {
        const monthStr = d3.timeFormat("%Y-%m")(date);
        return {
          date,
          count: d.monthly_post_counts[monthStr] || 0,
          monthStr,
          name: d.name
        };
      }))
      .join("rect")
      .attr("x", d => x(d.date))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth() * 0.8)
      .attr("y", y.bandwidth() * 0.1)
      .attr("fill", d => color(d.count))
      .append("title")
      .text(d => `${d.name}: ${d.count} posts in ${d.monthStr}`);
    
    console.log("Total cells:", processedData.length * allDates.length);


  }, [data, height, width, margin, rowHeight]);

  if (!data?.legislators?.length) {
    return <div className="flex items-center justify-center">No data available</div>;
  }

  return (
    <div style={{
      width: '100%',
      height: `${height}px`,
      overflowY: 'auto',
      border: '1px solid #eee'
    }}>
      <svg
        ref={svgRef}
        style={{
          display: 'block',
          width: '100%',
          height: `${totalHeight}px`
        }}
      />
    </div>
  );
};
