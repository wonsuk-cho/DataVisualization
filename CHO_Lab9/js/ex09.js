const ctx = {
    ATTRIB: '<a href="https://www.enseignement.polytechnique.fr/informatique/CSC_51052/">CSC_51052_EP</a> - <a href="https://www.adsbexchange.com/data-samples/">ADSBX sample data</a>, &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    PLANE_ICON_PATH: "icons/plane.svg",
    TRANSITION_DURATION: 1000,
    SC: 4,
    ADSBX_PREFIX: "1618",
    ADSBX_SUFFIX: "Z",
    MIN_ALT: 32000,
    visualizedFlights: [],
    planeUpdater: null,
    LFmap: null,
    selectedPlane: null,
    onGroundCount: 0,
    inSkyCount: 0,
    availableBasemaps: [
        "Streets",
        "Topographic",
        "Oceans",
        "NationalGeographic",
        "Physical",
        "Gray",
        "DarkGray",
        "Imagery",
        "ImageryClarity",
        "ImageryFirefly",
        "ShadedRelief",
        "Terrain",
        "USATopo"
    ],
    currentBasemap: "DarkGray"
};

// time indices for simulated data updates
const DATA_DUMP_TIME_INDICES = [...Array(12).keys()].map(i => i * 5);
let DATA_DUMP_TIME_INC = 1;

// map of basemap names to css filters for plane icons
const basemapPlaneFilters = {
    "DarkGray": "",
    "Imagery": "invert(1)",
    "ShadedRelief": "",
    "Terrain": "",
    "Oceans": "invert(1)",
    "Physical": "",
    "Gray": "",
    "Streets": "",
    "Topographic": "",
    "NationalGeographic": "",
    "USA Topo": ""
};

function createViz() {
    console.log("Using D3 v" + d3.version);
    createMap();
    populateBasemapSelector();
    loadFlights();
};

// get plane transformation string for positioning
function getPlaneTransform(d) {
    let point = ctx.LFmap.latLngToLayerPoint([d.lat, d.lon]);
    let px = point.x;
    let py = point.y;
    if (d.bearing != null && d.bearing != 0) {
        let t = `translate(${px},${py}) rotate(${d.bearing} ${ctx.SC} ${ctx.SC})`;
        return t;
    }
    else {
        let t = `translate(${px},${py})`;
        return t;
    }
};

// draw planes on the map
function drawPlanes(animateUpdates) {
    console.log("Drawing planes on the map");
    console.log(`Number of planes to display: ${ctx.visualizedFlights.length}`);

    let planesGroup = d3.select("#LFmap").select("svg").select("g#planes");

    let planes = planesGroup.selectAll("image")
        .data(ctx.visualizedFlights, function (d) { return d.id; });

    planes.exit()
        .each(function (d) {
            // console.log(`Removing plane ${d.callsign} (${d.id})`);
        })
        .remove();

    let planesEnter = planes.enter()
        .append("image")
        .attr("width", 8)
        .attr("height", 8)
        .attr("xlink:href", ctx.PLANE_ICON_PATH)
        .attr("id", function (d) { return "p-" + d.id; }) 
        .attr("transform", function (d) {
            return getPlaneTransform(d); 
        })
        .style("filter", basemapPlaneFilters[ctx.currentBasemap] || "")
        .each(function (d) {
            console.log(`Adding new plane ${d.callsign} (${d.id}) at position (${d.lat}, ${d.lon})`);
        });

    planesEnter.merge(planes)
        .transition().duration(animateUpdates ? ctx.TRANSITION_DURATION : 0)
        .attr("transform", function (d) {
            return getPlaneTransform(d); 
        })
        .each(function (d) {
            // console.log(`Updating plane ${d.callsign} (${d.id}) to position (${d.lat}, ${d.lon})`);
        });
}

// create the map instance and setup layers
function createMap() {
    ctx.LFmap = L.map('LFmap');
    L.DomUtil.addClass(ctx.LFmap._container, 'crosshair-cursor-enabled');

    ctx.basemapLayer = L.esri.basemapLayer(ctx.currentBasemap, {
        detectRetina: true,
        attribution: ctx.ATTRIB
    }).addTo(ctx.LFmap);

    addBasemapAdditionalLayers(ctx.currentBasemap);

    ctx.LFmap.setView([0, 0], 2);
    ctx.LFmap.on('click', function (e) {
        showDetails(getClosestPlane(e.latlng));
    });
    L.svg().addTo(ctx.LFmap);
    let svgEl = d3.select("#LFmap").select("svg");
    svgEl.select("g")
        .attr("id", "planes");
    ctx.LFmap.on('zoom', function () { drawPlanes(false); });
};

function loadFlights() {
    let tMin = "00";
    loadPlanesFromLocalDump(`data/${ctx.ADSBX_PREFIX}${tMin}${ctx.ADSBX_SUFFIX}.json`, false);
    startPlaneUpdater(); // uncomment when reaching Section 2.2
}

// process aircraft data and update the flight list
function processAircraftData(data) {
    ctx.visualizedFlights = [];

    ctx.onGroundCount = 0;
    ctx.inSkyCount = 0;

    data.aircraft.forEach(function (plane) {
        const alt = plane.alt_baro;
        const lat = plane.lat;
        const lon = plane.lon;
        const track = plane.track;

        if (typeof alt === 'number' &&
            typeof lat === 'number' && typeof lon === 'number' &&
            !(lat === 0 && lon === 0)) {

            const continent = getContinent(lat, lon);

            const status = alt <= 0 ? "On Ground" : "In Sky";

            if (status === "On Ground") {
                ctx.onGroundCount++;
            } else {
                ctx.inSkyCount++;
            }

            let newPlane = {
                id: plane.hex,
                callsign: plane.flight ? plane.flight.trim() : "",
                type: plane.t,
                lat: lat,
                lon: lon,
                bearing: track,
                alt: alt,
                continent: continent,
                status: status
            };
            ctx.visualizedFlights.push(newPlane);
        }
    });
}

// load plane data from local dump
function loadPlanesFromLocalDump(dumpPath, animate) {
    d3.select("img#inProg").style("visibility", "visible");
    console.log(`Querying local ADSBX dump ${dumpPath}...`);
    d3.json(dumpPath).then(
        function (data) {
            processAircraftData(data);
            d3.select("img#inProg").style("visibility", "hidden");
            drawPlanes(animate);
            drawScatterPlot(); 
            drawBarGraph();   
        }
    ).catch(function (err) { console.log(err); });
};

// display plane details in info panel
function showDetails(plane) {
    d3.select("#info").text(`Callsign: ${plane.callsign} , Plane Type: ${plane.type} (ID: ${plane.id})`);
    console.log(`Plane selected: ${plane.callsign} ${plane.type} (${plane.id})`);

    if (ctx.selectedPlane == null) {
        ctx.selectedPlane = d3.select(`#p-${plane.id}`);
    } else {
        ctx.selectedPlane.style("filter", "none");
        ctx.selectedPlane.style("outline", "none");
        ctx.selectedPlane = d3.select(`#p-${plane.id}`);
    }
    ctx.selectedPlane.style("filter", "drop-shadow(0px 0px 1px rgb(128,0,128))");
    ctx.selectedPlane.style("outline", "1px solid rgba(128,0,128,0.5)");
}

// find the closest plane to cursor
function getClosestPlane(cursorCoords) {
    let res = ctx.visualizedFlights[0];
    let smallestDist = Math.pow(res.lon - cursorCoords.lng, 2) + Math.pow(res.lat - cursorCoords.lat, 2);
    for (let i = 1; i < ctx.visualizedFlights.length; i++) {
        let dist = Math.pow(ctx.visualizedFlights[i].lon - cursorCoords.lng, 2) + Math.pow(ctx.visualizedFlights[i].lat - cursorCoords.lat, 2);
        if (dist < smallestDist) {
            res = ctx.visualizedFlights[i];
            smallestDist = dist;
        }
    }
    let newSelection = d3.select(`#p-${res.callsign}`);
    if (ctx.selectedPlane == null) {
        ctx.selectedPlane = newSelection;
    }
    else {
        ctx.selectedPlane.style("filter", "none");
        ctx.selectedPlane.style("outline", "none");
        ctx.selectedPlane = newSelection;
    }
    ctx.selectedPlane.style("filter", "drop-shadow(0px 0px 1px rgb(128,0,128))");
    ctx.selectedPlane.style("outline", "1px solid rgb(128,0,128,.5)");
    return res;
}

function toggleUpdate() {
    if (ctx.planeUpdater != null) {
        clearInterval(ctx.planeUpdater);
        ctx.planeUpdater = null;
        d3.select("#updateBt").attr("value", "Off");
        console.log("Plane updates stopped");
    } else {
        startPlaneUpdater();
        d3.select("#updateBt").attr("value", "On");
        console.log("Plane updates started");
    }
}

function startPlaneUpdater() {
    ctx.planeUpdater = setInterval(
        function () {
            let tMin = String(DATA_DUMP_TIME_INDICES[DATA_DUMP_TIME_INC]).padStart(2, '0');
            console.log(`Updating planes for time index ${tMin}`);
            loadPlanesFromLocalDump(`data/${ctx.ADSBX_PREFIX}${tMin}${ctx.ADSBX_SUFFIX}.json`, tMin != "00");
            if (DATA_DUMP_TIME_INC == DATA_DUMP_TIME_INDICES.length - 1) {
                DATA_DUMP_TIME_INC = 0;
            }
            else {
                DATA_DUMP_TIME_INC++;
            }
        },
        500); // change the speed of the update
}

// populate basemap selector dropdown
function populateBasemapSelector() {
    console.log("Populating basemap selector");
    let selector = d3.select("#basemapSelector");
    selector.selectAll("option")
        .data(ctx.availableBasemaps)
        .enter()
        .append("option")
        .attr("value", function (d) { return d; })
        .text(function (d) { return d; });
    selector.property("value", ctx.currentBasemap);
}

// change the basemap layer
function changeBasemap() {
    let selectedBasemap = d3.select("#basemapSelector").property("value");
    console.log(`Changing basemap to ${selectedBasemap}`);

    ctx.currentBasemap = selectedBasemap;

    if (ctx.basemapLayer) {
        ctx.LFmap.removeLayer(ctx.basemapLayer);
    }

    if (ctx.basemapLabelsLayer) {
        ctx.LFmap.removeLayer(ctx.basemapLabelsLayer);
        ctx.basemapLabelsLayer = null;
    }
    if (ctx.basemapRefLayer) {
        ctx.LFmap.removeLayer(ctx.basemapRefLayer);
        ctx.basemapRefLayer = null;
    }

    ctx.basemapLayer = L.esri.basemapLayer(ctx.currentBasemap, {
        detectRetina: true,
        attribution: ctx.ATTRIB
    }).addTo(ctx.LFmap);

    addBasemapAdditionalLayers(ctx.currentBasemap);

    updatePlaneStyles();
}

// add additional layers to the basemap
function addBasemapAdditionalLayers(basemap) {
    if (basemap === 'Gray' || basemap === 'DarkGray') {
        ctx.basemapLabelsLayer = L.esri.basemapLayer(basemap + 'Labels').addTo(ctx.LFmap);
    } else if (basemap === 'Imagery' || basemap === 'ShadedRelief' || basemap === 'Terrain') {
        ctx.basemapLabelsLayer = L.esri.basemapLayer(basemap + 'Labels').addTo(ctx.LFmap);
    } else if (basemap === 'Oceans') {
        ctx.basemapRefLayer = L.esri.basemapLayer('OceansLabels').addTo(ctx.LFmap);
    }
}

// update plane styles based on basemap
function updatePlaneStyles() {
    let filter = basemapPlaneFilters[ctx.currentBasemap] || "";
    console.log(`Applying filter "${filter}" to planes for basemap "${ctx.currentBasemap}"`);

    d3.select("#LFmap").select("svg").select("g#planes").selectAll("image")
        .style("filter", filter);
}

// get continent name based on coordinates
// https://craiggrummitt.com/2019/02/27/get-a-continent-from-longitude-latitude/
// got help from ChatGPT with the link
function getContinent(lat, lon) {
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        if (lat >= -10 && lat <= 35 && lon >= -20 && lon <= 55) {
            return "Africa";
        } else if (lat >= 35 && lat <= 70 && lon >= -10 && lon <= 40) {
            return "Europe";
        } else if (lat >= 5 && lat <= 55 && lon >= 55 && lon <= 180) {
            return "Asia";
        } else if (lat >= -55 && lat <= 15 && lon >= 110 && lon <= 180) {
            return "Australia";
        } else if (lat >= 15 && lat <= 75 && lon >= -170 && lon <= -50) {
            return "North America";
        } else if (lat >= -60 && lat <= 15 && lon >= -80 && lon <= -30) {
            return "South America";
        } else {
            return "Others";
        }
    } else {
        return "Unknown";
    }
}

// draw scatter plot for flights data
function drawScatterPlot() {
    const margin = { top: 20, right: 30, bottom: 70, left: 70 };
    const width = 700 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    d3.select("#scatterplot").select("svg").remove();

    const svg = d3.select("#scatterplot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background-color", "#1b1b1b")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const continents = [...new Set(ctx.visualizedFlights.map(d => d.continent))];

    const xScale = d3.scaleBand()
        .domain(continents)
        .range([0, width])
        .padding(0.1);

    const yMin = 0;
    const yMax = d3.max(ctx.visualizedFlights, d => d.alt);
    const yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([height, 0]);

    // x axis
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("fill", "white")
        .style("text-anchor", "middle");

    // y axis
    svg.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("fill", "white"); 

    // axis labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 35)
        .attr("text-anchor", "middle")
        .style("fill", "white")
        .style("font-size", "14px")
        .text("Continent");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .attr("text-anchor", "middle")
        .style("fill", "white")
        .style("font-size", "14px")
        .text("Altitude (ft)");

    const tooltip = d3.select("#scatterplot").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    const altColorRange = ["#ed1b25", "#fff200", "#ffffff", "#00aeef", "#525ccc"];
    const altColorDomain = [0, 16000, 32000, 40000, 48000];

    const colorScale = d3.scaleLinear()
        .domain(altColorDomain)
        .range(altColorRange)
        .clamp(true);

    const bandwidth = xScale.bandwidth();
    const densityScale = d3.scaleLinear()
        .range([0, bandwidth / 2]);

    continents.forEach(continent => {
        const continentData = ctx.visualizedFlights.filter(d => d.continent === continent);
        const altitudes = continentData.map(d => d.alt);

        if (altitudes.length > 0) {
            const yValues = d3.range(yMin, yMax, (yMax - yMin) / 50);
            const kde = kernelDensityEstimator(kernelEpanechnikov(1000), yValues);
            const density = kde(altitudes);

            const maxDensity = d3.max(density, d => d[1]);
            densityScale.domain([0, maxDensity]);

            svg.append("path")
                .datum(density)
                .attr("fill", "#2a2a2a")
                .attr("stroke", "#2a2a2a")
                .attr("opacity", 0.7)
                .attr("transform", `translate(${xScale(continent) + bandwidth / 2},0)`)
                .attr("d", d3.area()
                    .curve(d3.curveBasis)
                    .x0(d => -densityScale(d[1]))
                    .x1(d => densityScale(d[1]))
                    .y(d => yScale(d[0]))
                );
        }
    });

    svg.selectAll("circle")
        .data(ctx.visualizedFlights)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.continent) + xScale.bandwidth() / 2 + (Math.random() - 0.5) * bandwidth * 0.8)
        .attr("cy", d => yScale(d.alt))
        .attr("r", 3)
        .style("fill", d => colorScale(d.alt))
        .style("opacity", 0.8)
        .on("mouseover", function (event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`Callsign: ${d.callsign}<br>Altitude: ${d.alt} ft<br>Continent: ${d.continent}`)
                .style("left", (event.layerX + 15) + "px")
                .style("top", (event.layerY - 28) + "px");
        })
        .on("mouseout", function () {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
}

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

// draw bar graph for plane status data
function drawBarGraph() {
    const margin = { top: 20, right: 30, bottom: 70, left: 70 };
    const width = 400 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    d3.select("#bargraph").select("svg").remove();

    const svg = d3.select("#bargraph")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background-color", "#1b1b1b")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = [
        { status: "On Ground", count: ctx.onGroundCount },
        { status: "In Sky", count: ctx.inSkyCount }
    ];

    const xScale = d3.scaleBand()
        .domain(data.map(d => d.status))
        .range([0, width])
        .padding(0.4);

    const yMax = d3.max(data, d => d.count);
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([height, 0]);

    // x axis
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("fill", "white")
        .style("text-anchor", "middle");

    // y axis
    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll("text")
        .style("fill", "white");

    // axis labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 30)
        .attr("text-anchor", "middle")
        .style("fill", "white")
        .style("font-size", "14px")
        .text("Plane Status");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .attr("text-anchor", "middle")
        .style("fill", "white")
        .style("font-size", "14px")
        .text("Number of Planes");

    // bars
    svg.selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.status))
        .attr("y", d => yScale(d.count))
        .attr("width", xScale.bandwidth())
        .attr("height", d => height - yScale(d.count))
        .attr("fill", "#00aeef")
        .on("mouseover", function (event, d) {
            d3.select(this)
                .attr("fill", "#ed1b25");

            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
            tooltip.html(`${d.status}: ${d.count}`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .attr("fill", "#00aeef");

            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    const tooltip = d3.select("#bargraph").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
}

/*
Lab 9 Assignment Submission

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
https://www.adsbexchange.com/version-2-api-wip/
https://stackoverflow.com/questions/16256454/d3-js-position-tooltips-using-element-position-not-mouse-position
*/