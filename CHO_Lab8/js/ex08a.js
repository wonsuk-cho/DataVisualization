const ctx = {
    TM_WIDTH: 1280,
    TM_HEIGHT: 720,
};

function clipText() {
    d3.select("svg").selectAll(".leaf").append("clipPath")
        .attr("id", d => "clip-" + d.data.id)
        .append("use")
        .attr("xlink:href", d => "#" + d.data.id);
    d3.selectAll(".leaf text")
        .attr("clip-path", d => `url(#clip-${d.data.id})`);
}

function createTreemap(root) {
    const colorScheme = d3.schemeCategory10;
    const fader = function (c) { return d3.interpolateRgb(c, "#fff")(0.6); };
    const desaturatedColors = colorScheme.map(fader);
    const colorScale = d3.scaleOrdinal(desaturatedColors);

    console.log("Creating treemap with root:", root);

    let treemapLayout = d3.treemap()
        .tile(d3.treemapBinary)
        .size([ctx.TM_WIDTH, ctx.TM_HEIGHT])
        .paddingInner(2)
        .paddingOuter(5)
        .round(true);

    root.eachBefore(d => {
        d.data.id = d.data.Code;
    });
    console.log("Assigned IDs to nodes");

    root.sum(sumByAmount);

    function sumByAmount(d) {
        // return 1;
        return d.Amount ? +d.Amount : 0;
    }

    treemapLayout(root);
    console.log("Applied treemap layout to root");

    const firstLevelCodes = root.children.map(d => d.data.Code);
    const colorMap = {};
    firstLevelCodes.forEach((code, i) => {
        colorMap[code] = desaturatedColors[(i + 1) % desaturatedColors.length];
    });
    console.log("Color map for first-level categories:", colorMap);

    let nodes = d3.select("svg").selectAll("g")
        .data(root.descendants())
        .enter().append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
        .classed("leaf", d => !d.children);

    nodes.append("rect")
        .attr("id", d => d.data.id)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .style("stroke", d => {
            if (d.depth === 0) {
                return colorScheme[0];
            }
            else if (d.depth === 1) {
                return tinycolor(colorMap[d.data.Code]).darken(40).toString();
            }
            else {
                return tinycolor(colorMap[d.ancestors().find(a => a.depth === 1).data.Code]).darken(40).toString();
            }
        })
        .style("stroke-width", d => {
            if (d.depth === 0) {
                return 1;
            } else if (d.depth === 1) {
                return 1;
            } else {
                return 1;
            }
        })
        .style("fill", d => {
            if (d.depth === 0) {
                return fader(colorScheme[0]);
            } else if (d.depth === 1) {
                return colorMap[d.data.Code];
            } else {
                return colorMap[d.ancestors().find(a => a.depth === 1).data.Code];
            }
        });

    d3.selectAll(".leaf").append("text")
        .style("fill", d => {
            let rectColor = d3.select(`#${d.data.id}`).style("fill");
            let textColor = tinycolor(rectColor).darken(40).toString();
            return textColor;
        })
        .selectAll("tspan")
        .data(d => d.data.Description ? d.data.Description.split(" ") : [])
        .enter().append("tspan")
        .attr("x", 4)
        .attr("y", (d, i) => 13 + i * 10)
        .text(d => d);

    // text within rectangle
    clipText();
}

function createViz() {
    console.log("Using D3 v" + d3.version);
    d3.select("#main").append("svg")
        .attr("width", ctx.TM_WIDTH)
        .attr("height", ctx.TM_HEIGHT);
    loadData();
}

// load and process the data
function loadData() {
    d3.csv("data/cofog.csv").then(function (data) {
        console.log("Data loaded:", data);

        data.push({
            Level: "0",
            Code: "COFOG",
            Amount: "",
            Description: "Root node"
        });

        console.log("Data with root node added:", data);

        function getParentId(code) {
            if (code === "COFOG") {
                return null;
            } else if (code.length <= 4) {
                return "COFOG";
            } else {
                return code.substring(0, code.length - 2);
            }
        }

        //stratify function
        let stratify = d3.stratify()
            .id(function (d) { return d.Code; })
            .parentId(function (d) {
                return getParentId(d.Code);
            });

        // reconstruct hierarchy
        let root = stratify(data);
        console.log("Stratified data (root):", root);
        createTreemap(root);
    }).catch(function (error) {
        console.error("Error loading or processing data:", error);
    });
}

/*
Lab 8 Assignment Submission

Name: Won Suk CHO
Program: M2 IoT

References:
https://d3js.org/d3-hierarchy/stratify
https://d3js.org/d3-hierarchy/treemap
https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect
https://d3js.org/d3-scale-chromatic
https://d3js.org/d3-scale-chromatic/categorical
https://github.com/bgrins/TinyColor/blob/master/README.md
https://d3js.org/d3-hierarchy/hierarchy#node_sum
*/