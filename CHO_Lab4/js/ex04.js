/*
Lab 4 Assignment Submission

Name: Won Suk CHO
Program: M2 IoT

References:
https://www.d3-graph-gallery.com/boxplot
https://www.d3-graph-gallery.com/density.html
https://www.d3-graph-gallery.com/graph/interactivity_tooltip.html
https://www.d3-graph-gallery.com/graph/line_transition.html
https://www.d3-graph-gallery.com/graph/custom_axis.html
https://www.d3-graph-gallery.com/graph/barplot_basic.html
https://observablehq.com/@d3/d3-scale
https://observablehq.com/@mbostock/kernel-density-estimation
https://www.d3-graph-gallery.com/graph/area_basic.html
https://github.com/d3/d3-transition
https://stackoverflow.com/questions/16256454/d3-js-position-tooltips-using-element-position-not-mouse-position
*/
const ctx = {
    CHART_WIDTH: 1280,
    CHART_HEIGHT: 720,
    JITTER_W: 50,
    TEMP_COLOR_RANGE: ["#ed1b25", "#fff200", "#ffffff", "#00aeef", "#525ccc"],
    TEMP_COLOR_DOMAIN: [3200, 6000, 9000, 15000, 32000],
    TEMP_TICK_INTERVAL: 5000,
    MARGIN: { top: 100, right: 100, bottom: 100, left: 100 }
};

let svgTooltip;

// Define star types
const starTypes = ["O", "B", "A", "F", "G", "K", "M", "All"];

// Function to draw the main canvas
function drawCanvas() {
    console.log("Creating the main SVG canvas.");

    const svg = d3.select("#main")
        .append("svg")
        .attr("width", ctx.CHART_WIDTH)
        .attr("height", ctx.CHART_HEIGHT);

    const mainG = svg.append("g").attr("id", "mainG")
        .attr("transform", `translate(${ctx.MARGIN.left}, ${ctx.MARGIN.top})`);

    console.log("SVG canvas created. Starting data load...");

    loadData();
}

/*-------------- 1. Scales ------------------------*/
/*
Initialize the y-axis and x-axis scales, and draw the axes.
*/
/*===== START =====*/

// Function to draw the Y-axis with a linear temperature scale
function drawYAxis(mainG, data) {
    console.log("Drawing Y-axis with temperature scale.");

    const tempExtent = d3.extent(data, d => d.Teff); // Find the min and max temperature
    console.log("Temperature extent (min, max):", tempExtent);

    const yScale = d3.scaleLinear()
        .domain([0, tempExtent[1]]) // Ensure domain starts from 0
        .range([ctx.CHART_HEIGHT - ctx.MARGIN.top - ctx.MARGIN.bottom, 0]); // Adjusted range

    console.log("Y-axis scale domain:", yScale.domain());
    console.log("Y-axis scale range:", yScale.range());

    // Define Y-axis
    const yAxis = d3.axisLeft(yScale)
        .ticks((tempExtent[1] - tempExtent[0]) / ctx.TEMP_TICK_INTERVAL)
        .tickFormat(d => d3.format("~")(d));  // No scientific notation

    // Append the Y-axis
    mainG.append("g")
        .attr("id", "y-axis")
        .call(yAxis);

    // Add Y-axis label
    mainG.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -ctx.MARGIN.left + 20)
        .attr("x", -(ctx.CHART_HEIGHT - ctx.MARGIN.top - ctx.MARGIN.bottom) / 2)
        .style("text-anchor", "middle")
        .style("fill", "white")
        .text("Temperature (K)");

    console.log("Y-axis drawn.");

    return yScale; // Return the yScale for use in the scatterplot
}

// Function to draw the X-axis at the bottom of the chart
function drawXAxis(mainG) {
    console.log("Drawing X-axis with star types.");

    const xScale = d3.scaleBand()
        .domain(starTypes)
        .range([0, ctx.CHART_WIDTH - ctx.MARGIN.left - ctx.MARGIN.right])
        .padding(0.1);

    console.log("X-axis scale domain:", xScale.domain());
    console.log("X-axis scale range:", xScale.range());

    // Define X-axis
    const xAxis = d3.axisBottom(xScale);

    // Append the X-axis and position it at the bottom
    mainG.append("g")
        .attr("id", "x-axis")
        .attr("transform", `translate(0, ${ctx.CHART_HEIGHT - ctx.MARGIN.top - ctx.MARGIN.bottom})`)
        .call(xAxis);

    // Add X-axis title "Star Types"
    mainG.append("text")
        .attr("x", (ctx.CHART_WIDTH - ctx.MARGIN.left - ctx.MARGIN.right) / 2)
        .attr("y", ctx.CHART_HEIGHT - ctx.MARGIN.top - ctx.MARGIN.bottom + 60)
        .style("text-anchor", "middle")
        .style("fill", "white")
        .text("Star Types");

    console.log("X-axis drawn.");

    return xScale;
}

/*===== END =====*/

/*-------------- 2. Raw Data Points ------------------------*/
/*
Populate each of the star type groups with circles representing stars.
*/
/*===== START =====*/

// Function to generate color for temperature
function createColorScale() {
    console.log("Creating color scale for star temperatures.");
    const colorScale = d3.scaleLinear()
        .domain(ctx.TEMP_COLOR_DOMAIN)
        .range(ctx.TEMP_COLOR_RANGE);

    console.log("Color scale domain:", colorScale.domain());
    console.log("Color scale range:", colorScale.range());

    return colorScale;
}

/*===== END =====*/

/*-------------- 3. Boxplots ------------------------*/
/*
Draw box plots on top of the raw data points.
*/
/*===== START =====*/

// Function to calculate summary statistics for each star type
function getSummaryStatistics(data) {
    const values = data.map(d => d.Teff).sort(d3.ascending);
    const q1 = d3.quantile(values, 0.25);
    const median = d3.median(values);
    const q3 = d3.quantile(values, 0.75);
    const min = d3.min(values);
    const max = d3.max(values);

    console.log(`Summary statistics for ${data[0].SpType.trim()}:`);
    console.log({ q1, median, q3, min, max });

    return { q1, median, q3, min, max };
}

/*===== END =====*/

/*-------------- 4. Density Plots ------------------------*/
/*
Add density plots to illustrate the distribution of temperatures across star types.
*/
/*===== START =====*/

// Function to compute kernel density estimation
function kernelDensityEstimator(kernel, x) {
    return function (sample) {
        return x.map(function (x) {
            return [x, d3.mean(sample, function (v) { return kernel(x - v); })];
        });
    };
}

function kernelEpanechnikov(k) {
    return function (v) {
        v = v / k;
        return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) / k : 0;
    };
}

function densityPlot(data, scale) {
    console.log("Computing density plot data.");
    // Create an array of Teff values
    const values = data.map(d => d.Teff);

    // Define the range of Teff values
    const x = d3.range(scale.domain()[0], scale.domain()[1], (scale.domain()[1] - scale.domain()[0]) / 100);

    // Define the kernel
    const kde = kernelDensityEstimator(kernelEpanechnikov(1000), x);

    // Compute the density estimation
    const density = kde(values);

    console.log("Density data length:", density.length);
    console.log("Density plot data computed.");
    return density;
}

/*===== END =====*/

/*-------------- 5. Enhancements ------------------------*/
/*
Add interactive and animation features.
*/
/*===== START =====*/

// Add this before the starTypes.forEach loop in the plotStarsAndBoxPlots function
function plotStarsAndBoxPlots(mainG, starsWithTeff, yScale, xScale) {
    const colorScale = createColorScale();

    console.log("Computing star counts for each star type.");

    // Compute star counts for each star type and find the maximum count
    const starCountsMap = {};
    starTypes.forEach(type => {
        const groupData = starsWithTeff.filter(d => (d.SpType && d.SpType.trim().startsWith(type)) || type === "All");
        starCountsMap[type] = groupData.length;
    });
    const maxStarCount = d3.max(Object.values(starCountsMap));

    console.log("Star counts per star type:", starCountsMap);
    console.log("Maximum star count across star types:", maxStarCount);

    // Variables for box width, whisker cap length, and opacity
    const boxWidth = xScale.bandwidth() * 0.6;  // Adjustable box width relative to xScale bandwidth
    const capLength = boxWidth * 0.5;      // Adjustable whisker cap length
    const opacity = 0.5;       // Adjustable opacity
    const densityOpacity = 0.7;        // Opacity variable for density plot

    starTypes.forEach((type, index) => {
        const groupData = starsWithTeff.filter(d => (d.SpType && d.SpType.trim().startsWith(type)) || type === "All");
        console.log(`Plotting ${groupData.length} stars for star type ${type}.`);

        // Compute the animation duration based on the star count
        const starCount = starCountsMap[type];
        const minDuration = 1000;  // Minimum duration in milliseconds
        const maxDuration = 3000;  // Maximum duration in milliseconds
        const duration = minDuration + (starCount / maxStarCount) * (maxDuration - minDuration);

        console.log(`Animation duration for star type ${type}: ${duration} ms`);

        // Create a group for each star type
        const groupG = mainG.append("g")
            .attr("id", `group_${type}`)
            .attr("transform", `translate(${xScale(type)}, 0)`);

        // ---- Plot Circles First ----
        // Plot raw data points (circles)
        const circlesGroup = groupG.append("g");

        circlesGroup.selectAll("circle")
            .data(groupData)
            .enter()
            .append("circle")
            .attr("cx", () => xScale.bandwidth() / 2 + Math.random() * ctx.JITTER_W - ctx.JITTER_W / 2)
            .attr("cy", -10)  // Start position A: above the chart
            .attr("r", 1.5)  // Adjust the radius as needed
            .style("fill", d => colorScale(d.Teff))
            .attr("opacity", 0.8)
            .on("mouseover", function(event, d) {
                // Remove any existing tooltips to avoid duplicates
                if (svgTooltip) svgTooltip.remove();
            
                // Create the tooltip group at the mouse position
                svgTooltip = mainG.append("g")
                    .attr("transform", `translate(${event.offsetX - ctx.MARGIN.left + 10}, ${event.offsetY - ctx.MARGIN.top - 30})`);
            
                // Add a rect for the background with dynamic width based on text length
                svgTooltip.append("rect")
                    .attr("width", 180)  // Adjust this width based on text length
                    .attr("height", 25)  // Adjust this height to fit your text
                    .attr("fill", "rgba(255, 255, 255, 0.7)")  // White background with 70% opacity
                    .attr("rx", 5)  // Rounded corners
                    .attr("ry", 5);
            
                // Add text inside the tooltip
                svgTooltip.append("text")
                    .attr("y", 10)  // Vertically centered in the rectangle
                    .attr("fill", "black")  // Black font color
                    .style("font-size", "10px")
                    .html(`<tspan x="10" dy="0">Gaia Source: ${d.Source}</tspan>
                           <tspan x="10" dy="1.2em">Temperature = ${d.Teff} K</tspan>`);
            })
            .on("mouseout", function() {
                // Remove the tooltip when the mouse is out
                if (svgTooltip) svgTooltip.remove();
            })                       
            .transition()
            .duration(duration)
            .attr("cy", d => yScale(d.Teff));  // Position B: actual position

        // Animate the star count value from 0 to the actual count
        mainG.append("text")
            .attr("x", xScale(type) + xScale.bandwidth() / 2)
            .attr("y", ctx.CHART_HEIGHT - ctx.MARGIN.top - ctx.MARGIN.bottom + 30)
            .attr("text-anchor", "middle")
            .style("fill", "gray")
            .text(0)
            .transition()
            .duration(duration)
            .tween("text", function() {
                const i = d3.interpolateNumber(0, starCount);
                return function(t) {
                    this.textContent = Math.round(i(t));
                };
            });

        // Delay drawing the box plot and density plot until after circles are positioned
        // Compute summary statistics for the box plot
        const summary = getSummaryStatistics(groupData);

        // Draw box for interquartile range (IQR)
        groupG.append("rect")
            .datum(summary)
            .attr("x", xScale.bandwidth() / 2 - boxWidth / 2)  // Center the box
            .attr("y", d => yScale(d.q3))  // Start at Q3
            .attr("width", boxWidth)
            .attr("height", d => yScale(d.q1) - yScale(d.q3))  // Height from Q1 to Q3
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0)  // Start with opacity 0
            .style("pointer-events", "none")
            .transition()
            .delay(duration)
            .duration(500)
            .attr("opacity", opacity);  // Fade in after circles are done

        // Draw median line
        groupG.append("line")
            .datum(summary)
            .attr("x1", xScale.bandwidth() / 2 - boxWidth / 2)
            .attr("x2", xScale.bandwidth() / 2 + boxWidth / 2)
            .attr("y1", d => yScale(d.median))
            .attr("y2", d => yScale(d.median))
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0)  // Start with opacity 0
            .style("pointer-events", "none")
            .transition()
            .delay(duration)
            .duration(500)
            .attr("opacity", opacity);  // Fade in after circles are done

        // Draw whiskers for min and max with perpendicular lines
        groupG.append("line")
            .datum(summary)
            .attr("x1", xScale.bandwidth() / 2)
            .attr("x2", xScale.bandwidth() / 2)
            .attr("y1", d => yScale(d.min))
            .attr("y2", d => yScale(d.q1))
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0)  // Start with opacity 0
            .style("pointer-events", "none")
            .transition()
            .delay(duration)
            .duration(500)
            .attr("opacity", opacity);  // Fade in after circles are done

        groupG.append("line")
            .datum(summary)
            .attr("x1", xScale.bandwidth() / 2)
            .attr("x2", xScale.bandwidth() / 2)
            .attr("y1", d => yScale(d.max))
            .attr("y2", d => yScale(d.q3))
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0)  // Start with opacity 0
            .style("pointer-events", "none")
            .transition()
            .delay(duration)
            .duration(500)
            .attr("opacity", opacity);  // Fade in after circles are done

        // Add perpendicular lines (whisker caps) at the whiskers (top and bottom)
        groupG.append("line")
            .datum(summary)
            .attr("x1", xScale.bandwidth() / 2 - capLength / 2)  // Adjust cap length
            .attr("x2", xScale.bandwidth() / 2 + capLength / 2)
            .attr("y1", d => yScale(d.min))
            .attr("y2", d => yScale(d.min))
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0)  // Start with opacity 0
            .style("pointer-events", "none")
            .transition()
            .delay(duration)
            .duration(500)
            .attr("opacity", opacity);  // Fade in after circles are done

        groupG.append("line")
            .datum(summary)
            .attr("x1", xScale.bandwidth() / 2 - capLength / 2)  // Adjust cap length
            .attr("x2", xScale.bandwidth() / 2 + capLength / 2)
            .attr("y1", d => yScale(d.max))
            .attr("y2", d => yScale(d.max))
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0)  // Start with opacity 0
            .style("pointer-events", "none")
            .transition()
            .delay(duration)
            .duration(500)
            .attr("opacity", opacity);  // Fade in after circles are done

        // ---- Density Plot Implementation ----

        // Create an effTScale with the same domain and range as yScale
        const effTScale = d3.scaleLinear()
            .domain(yScale.domain())
            .range(yScale.range());

        // Compute the density data
        console.log(`Computing density plot for star type ${type}.`);
        const density = densityPlot(groupData, effTScale);

        // Create a density scale to map density values to x-offsets
        const maxDensity = d3.max(density, d => d[1]);
        const densityScale = d3.scaleLinear()
            .domain([0, maxDensity])
            .range([0, boxWidth / 2]); // Map to half of the box width

        console.log(`Drawing density plot for star type ${type}.`);
        // Draw the density area
        groupG.append("path")
            .datum(density)
            .attr("fill", "#2a2a2a")
            .attr("stroke", "none")
            .attr("opacity", 0)  // Start with opacity 0
            .attr("d", d3.area()
                .curve(d3.curveBasis)
                .x0(d => xScale.bandwidth() / 2 - densityScale(d[1]))
                .x1(d => xScale.bandwidth() / 2 + densityScale(d[1]))
                .y(d => yScale(d[0]))
            )
            .style("pointer-events", "none")
            .transition()
            .delay(duration)
            .duration(500)
            .attr("opacity", densityOpacity);  // Fade in after circles are done
    });
}

/*===== END =====*/

// Call this updated function after loading the data
function loadData() {
    console.log("Loading star data...");

    d3.csv("data/sample_gaia_DR3_2024.csv").then(function (data) {
        console.log("Total number of stars loaded:", data.length);
        console.log("Sample data:", data.slice(0,5));

        const starsWithTeff = data.filter(d => parseFloat(d.Teff) > 0)
            .map(d => ({ ...d, Teff: parseFloat(d.Teff), SpType: d.SpType_ELS ? d.SpType_ELS.trim() : "" }));

        console.log(`Stars with estimated temperature: ${starsWithTeff.length}`);
        console.log("Sample stars with Teff:", starsWithTeff.slice(0,5));

        // Call functions to create Y-axis and X-axis
        const mainG = d3.select("#mainG");
        const yScale = drawYAxis(mainG, starsWithTeff);
        const xScale = drawXAxis(mainG);

        // Plot stars, box plots, and density plots
        plotStarsAndBoxPlots(mainG, starsWithTeff, yScale, xScale);

        console.log("Data plotting complete.");

    }).catch(function (error) {
        console.error("Error loading data:", error);
    });
}

// Initialize the visualization
function createViz() {
    console.log("Using D3 v" + d3.version);
    drawCanvas(); // Call to draw the main canvas and load data
}
