const ctx = {
    RT_WIDTH: 1200,
    RT_HEIGHT: 1200,
};

function createRadialTree(root) {
    console.log("Creating radial tree with root:", root);

    let cluster = d3.cluster()
        .size([360, ctx.RT_WIDTH / 2 - 100]);

    cluster(root);

    let maxDepth = 0;
    root.each(d => {
        if (d.depth > maxDepth) maxDepth = d.depth;
    });

    root.each(d => {
        d.y = d.depth * (ctx.RT_WIDTH / 2 - 100) / maxDepth;
    });

    let links = root.links();
    let nodes = root.descendants();

    const colorScheme = d3.schemeCategory10;
    const colorScale = d3.scaleOrdinal(colorScheme);
    const firstLevelCodes = root.children.map(d => d.data.Code);
    const colorMap = {};
    firstLevelCodes.forEach(code => {
        colorMap[code] = colorScale(code);
    });

    let linkGenerator = d3.linkRadial()
        .angle(d => (d.x * Math.PI) / 180)
        .radius(d => d.y);

    let svg = d3.select("svg")
        .append("g")
        .attr("transform", `translate(${ctx.RT_WIDTH / 2}, ${ctx.RT_HEIGHT / 2})`);

    svg.selectAll("path.link")
        .data(links)
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", linkGenerator)
        .style("fill", "none")
        .style("stroke", d => {
            let ancestor = d.target.ancestors().find(a => a.depth === 1);
            return ancestor ? colorMap[ancestor.data.Code] : "#ccc";
        })
        .style("stroke-width", 1.5);

    let node = svg.selectAll("g.node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `rotate(${d.x - 90})translate(${d.y})`);

    node.append("circle")
        .attr("r", 2)
        .style("fill", d => {
            let ancestor = d.ancestors().find(a => a.depth === 1);
            return ancestor ? colorMap[ancestor.data.Code] : "#000";
        });

    node.append("text")
        .attr("dy", "0.31em")
        .attr("x", function(d) {
            if (d.children) {
                // labels inside
                return d.x < 180 ? -6 : 6;
            } else {
                // labels outside
                return d.x < 180 ? 6 : -6;
            }
        })
        .attr("text-anchor", function(d) {
            if (d.children) {
                // insede nodes
                return d.x < 180 ? "end" : "start";
            } else {
                // end nodes
                return d.x < 180 ? "start" : "end";
            }
        })
        .attr("transform", d => (d.x >= 180 ? "rotate(180)" : null))
        .text(d => {
            let label = d.data.Description || d.id;
            return label.length > 20 ? label.substring(0, 20) + "..." : label;
        })
        .style("fill", d => {
            let ancestor = d.ancestors().find(a => a.depth === 1);
            return ancestor ? colorMap[ancestor.data.Code] : "#000";
        });

    node.append("title")
        .text(d => d.data.Description || d.id);

    console.log("Radial tree created");
}

function createViz() {
    console.log("Using D3 v" + d3.version);
    d3.select("#main").append("svg")
        .attr("width", ctx.RT_WIDTH)
        .attr("height", ctx.RT_HEIGHT);
    loadData();
};

function loadData() {
    // Load cofog.csv
    d3.csv("data/cofog.csv").then(function (data) {
        console.log("Data loaded:", data);

        data.push({
            Level: "0",
            Code: "COFOG",
            Amount: "",
            Description: " "
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

        let stratify = d3.stratify()
            .id(function (d) { return d.Code; }) 
            .parentId(function (d) {
                return getParentId(d.Code);
            });

        let root = stratify(data);
        console.log("Stratified data (root):", root);

        createRadialTree(root);
    }).catch(function (error) {
        console.error("Error loading or processing data:", error);
    });
};

/*
Lab 8 Assignment Submission

Name: Won Suk CHO
Program: M2 IoT
*/