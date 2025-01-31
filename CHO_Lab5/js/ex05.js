/*
Lab 5 Assignment Submission

Name: Won Suk CHO
Course: M2 IoT
*/

const ctx = {
    REFERENCE_YEAR: "2010",
    w: 1200,
    h: 900,
    GREY_NULL: "#333",
    STAGE_DURATION: 1000,
    DOUBLE_CLICK_THRESHOLD: 320,
    totalStripPlotHeight: 420,
    totalLinePlotHeight: 900,
    vmargin: 2,
    hmargin: 4,
    timeParser: d3.timeParse("%Y-%m-%d"),
    yearAxisHeight: 20,
    linePlot: false,
    crossSeriesTempExtent: [0, 0],
    plotWidth: null,
};

const CITY_NAMES = ["boston", "new_york", "los_angeles", "anchorage", "dallas", "miami", "honolulu", "las_vegas", "phoenix", "new_orleans", "san_francisco", "seattle", "sacramento", "reno", "portland", "oklahoma_city", "memphis", "minneapolis", "kansas_city", "detroit", "denver", "albuquerque", "atlanta"];

// Transform data into a format suitable for the visualization
function transformData(data) {
    let temperatureSeries = { dates: [], series: [] };
    ctx.cityRefTemps = {};
    let cityDeltaTemps = {};
    CITY_NAMES.forEach((c) => {
        ctx.cityRefTemps[c] = [];
        cityDeltaTemps[c] = [];
    });
    data.filter((d) => d.time.startsWith(ctx.REFERENCE_YEAR)).forEach((date_record) => {
        CITY_NAMES.forEach((c) => {
            ctx.cityRefTemps[c].push(parseFloat(date_record[c]));
        });
    });
    data.forEach((date_record) => {
        temperatureSeries.dates.push(date_record.time);
        CITY_NAMES.forEach((city) => {
            let delta = parseFloat(date_record[city]) - getReferenceTemp(city, getMonth(date_record.time));
            cityDeltaTemps[city].push(delta);
        });
    });
    CITY_NAMES.forEach((c) => {
        temperatureSeries.series.push({ name: c, values: cityDeltaTemps[c] });
    });
    return temperatureSeries;
}

// Create color strip plot visualization
function createStrips(data, svgEl) {
    ctx.crossSeriesTempExtent = [
        d3.min(data.series, (d) => d3.min(d.values)),
        d3.max(data.series, (d) => d3.max(d.values))
    ];
    ctx.color = d3.scaleLinear()
        .domain([ctx.crossSeriesTempExtent[0], 0, ctx.crossSeriesTempExtent[1]])
        .range(["rgb(0, 51, 255)", "#f5f5f5", "rgb(255, 57, 57)"]);
    ctx.STRIP_H = (ctx.totalStripPlotHeight - ctx.yearAxisHeight) / data.series.length;

    data.series.forEach((s, i) => {
        let mapG = svgEl.append("g")
            .datum(s)
            .classed("plot", true)
            .attr("transform", `translate(${ctx.hmargin},${i * ctx.STRIP_H})`);

        mapG.selectAll("line")
            .data(s.values)
            .enter()
            .append("line")
            .attr("x1", (d, j) => j)
            .attr("y1", ctx.vmargin)
            .attr("x2", (d, j) => j)
            .attr("y2", ctx.STRIP_H - ctx.vmargin)
            .attr("stroke", (d) => (d == null ? ctx.GREY_NULL : ctx.color(d)));

        mapG.append("text")
            .attr("x", ctx.plotWidth + 10)
            .attr("y", ctx.STRIP_H - ctx.vmargin - 3)
            .text(formatCity(s.name));
    });

    let timeScale = d3.scaleTime()
        .domain(d3.extent(data.dates, (d) => ctx.timeParser(d)))
        .rangeRound([0, data.dates.length - 1]);
    svgEl.append("g")
        .attr("id", "yearAxis")
        .attr("transform", `translate(${ctx.hmargin},${ctx.totalStripPlotHeight - ctx.yearAxisHeight})`)
        .call(d3.axisBottom(timeScale).ticks(d3.timeYear.every(5)));

    let tempRange4legend = d3.range(ctx.crossSeriesTempExtent[0], ctx.crossSeriesTempExtent[1], .15).reverse();
    let scale4tempLegend = d3.scaleLinear()
        .domain(ctx.crossSeriesTempExtent)
        .rangeRound([tempRange4legend.length, 0]);
    let legendG = svgEl.append("g")
        .attr("id", "tempScale")
        .attr("opacity", 1)
        .attr("transform", `translate(1000,${ctx.totalStripPlotHeight / 2 - tempRange4legend.length / 2})`);
    legendG.selectAll("line")
        .data(tempRange4legend)
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("y1", (d, j) => j)
        .attr("x2", ctx.STRIP_H)
        .attr("y2", (d, j) => j)
        .attr("stroke", (d) => ctx.color(d));
    legendG.append("g")
        .attr("transform", `translate(${ctx.STRIP_H + 4},0)`)
        .call(d3.axisRight(scale4tempLegend).ticks(5));
    legendG.append("text")
        .attr("x", 40)
        .attr("y", tempRange4legend.length / 2)
        .style("fill", "#aaa")
        .text(`(Reference: ${ctx.REFERENCE_YEAR})`);
}

// Transition from color strips to line plots
function fromColorStripsToLinePlots() {
    let newStripHeight;
    console.log("Starting transition from Color Strips to Line Plots");

    d3.select("#tempScale")
        .transition()
        .duration(ctx.STAGE_DURATION)
        .attr("opacity", 0)
        .on("end", step1_2);

    function step1_2() {
        newStripHeight = (ctx.h - ctx.yearAxisHeight) / CITY_NAMES.length;
        let t = d3.transition().duration(ctx.STAGE_DURATION);

        d3.selectAll(".plot")
            .transition(t)
            .attr("transform", (d, i) => `translate(${ctx.hmargin},${i * newStripHeight})`);

        d3.select("#yearAxis")
            .transition(t)
            .attr("transform", `translate(${ctx.hmargin},${ctx.h - ctx.yearAxisHeight})`);

        t.end().then(step1_3);
    }

    function step1_3() {
        let t = d3.transition().duration(ctx.STAGE_DURATION);

        d3.selectAll(".plot line")
            .transition(t)
            .attr("y1", 0)
            .attr("y2", 1);

        t.end().then(step1_4);
    }

    function step1_4() {
        let t = d3.transition().duration(ctx.STAGE_DURATION);

        d3.selectAll(".plot line")
            .transition(t)
            .attr("stroke", ctx.GREY_NULL);

        t.end().then(step1_5);
    }

    function step1_5() {
        let xScale = d3.scaleLinear().domain([0, ctx.dataLength - 1]).range([0, ctx.plotWidth]);
        let yScale = d3.scaleLinear().domain(ctx.crossSeriesTempExtent).range([ctx.STRIP_H - ctx.vmargin, ctx.vmargin]);

        let t = d3.transition().duration(ctx.STAGE_DURATION);

        d3.selectAll(".plot").each(function (s) {
            let plotG = d3.select(this);

            plotG.selectAll("line")
                .transition(t)
                .delay((d, i) => i * 5)
                .attr("y1", 0)
                .attr("y2", ctx.STRIP_H - ctx.vmargin)
                .attr("stroke-opacity", 0)
                .remove();

            plotG.selectAll("circle")
                .data(s.values)
                .enter()
                .append("circle")
                .attr("cx", (d, i) => xScale(i))
                .attr("cy", 0)
                .attr("r", 0.1)
                .attr("fill", ctx.GREY_NULL)
                .transition(t)
                .delay((d, i) => i * 5)
                .attr("cy", (d) => yScale(d))
                .attr("r", 0.5);
        });
    }
}

// Transition back from line plots to color strips
async function fromLinePlotsToColorStrips() {
    await step2_1();
    await step2_2();
    await step2_3();
    await step2_4();
}

function step2_1() {
    return new Promise((resolve) => {
        let t = d3.transition().duration(ctx.STAGE_DURATION);

        d3.selectAll(".plot circle")
            .transition(t)
            .delay((d, i) => i * 5)
            .attr("cy", 0)
            .attr("r", 0)
            .remove();

        let xScale = d3.scaleLinear().domain([0, ctx.dataLength - 1]).range([0, ctx.plotWidth]);
        let yScale = d3.scaleLinear().domain(ctx.crossSeriesTempExtent).range([ctx.vmargin, ctx.STRIP_H - ctx.vmargin]);

        d3.selectAll(".plot").each(function (s) {
            let plotG = d3.select(this);

            plotG.selectAll("line")
                .data(s.values)
                .enter()
                .append("line")
                .attr("x1", (d, j) => xScale(j))
                .attr("y1", ctx.vmargin)
                .attr("x2", (d, j) => xScale(j))
                .attr("y2", ctx.vmargin)
                .attr("stroke", (d) => (d == null ? ctx.GREY_NULL : ctx.color(d)))
                .attr("stroke-opacity", 0)
                .transition(t)
                .delay((d, j) => j * 5)
                .attr("y2", ctx.STRIP_H - ctx.vmargin)
                .attr("stroke-opacity", 1);
        });

        d3.selectAll(".plot line").filter((d, i, nodes) => i === nodes.length - 1).transition(t).on("end", () => {
            resolve();
        });
    });
}

function step2_2() {
    return new Promise((resolve) => {
        let originalStripHeight = (ctx.totalStripPlotHeight - ctx.yearAxisHeight) / CITY_NAMES.length;
        let t = d3.transition().duration(ctx.STAGE_DURATION);

        d3.selectAll(".plot")
            .transition(t)
            .attr("transform", (d, i) => `translate(${ctx.hmargin}, ${i * originalStripHeight})`);

        d3.select("#yearAxis")
            .transition(t)
            .attr("transform", `translate(${ctx.hmargin}, ${ctx.totalStripPlotHeight - ctx.yearAxisHeight})`);

        d3.selectAll(".plot").filter((d, i, nodes) => i === nodes.length - 1).transition(t).on("end", () => {
            resolve();
        });
    });
}

function step2_3() {
    return new Promise((resolve) => {
        let t = d3.transition().duration(ctx.STAGE_DURATION);

        d3.selectAll(".plot line")
            .transition(t)
            .attr("y1", ctx.vmargin)
            .attr("y2", ctx.STRIP_H - ctx.vmargin);

        d3.selectAll(".plot line").filter((d, i, nodes) => i === nodes.length - 1).transition(t).on("end", () => {
            resolve();
        });
    });
}

function step2_4() {
    d3.select("#tempScale")
        .transition()
        .duration(ctx.STAGE_DURATION)
        .attr("opacity", 1);
}

function toggleVis() {
    if (ctx.linePlot) {
        fromLinePlotsToColorStrips();
    } else {
        fromColorStripsToLinePlots();
    }
    ctx.linePlot = !ctx.linePlot;
}

function createViz() {
    console.log("Using D3 v" + d3.version);
    let svgEl = d3.select("#main").append("svg");
    svgEl.attr("width", ctx.w);
    svgEl.attr("height", ctx.h);
    loadData(svgEl);
}

function loadData(svgEl) {
    d3.csv("data/US_City_Temp_Data.csv").then((data) => {
        let transformedData = transformData(data);
        ctx.dataLength = transformedData.dates.length;
        ctx.plotWidth = ctx.dataLength - 1;
        createStrips(transformedData, svgEl);
    }).catch((error) => console.log(error));
}

function formatCity(cityName) {
    let tokens = cityName.split("_");
    return tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
}

function getMonth(time) {
    return parseInt(time.substring(5, 7));
}

function getReferenceTemp(city, month) {
    return ctx.cityRefTemps[city][month - 1];
}