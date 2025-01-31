const ctx = {
    MAP_W: 1024,
    MAP_H: 1024,
    YEAR: "2020",
};

function createViz() {
    console.log("Using D3 v" + d3.version);

    d3.select("#mapContainer")
        .append("svg")
        .attr("width", ctx.MAP_W)
        .attr("height", ctx.MAP_H);

    loadData();
}

function loadData() {
    console.log("Loading data");

    const gra_promise = d3.json("data/0601/gra.geojson");
    const nutsrg_promise = d3.json("data/0601/nutsrg.geojson");
    const nutsbn_promise = d3.json("data/0601/nutsbn.geojson");
    const cntrg_promise = d3.json("data/0601/cntrg.geojson");
    const cntbn_promise = d3.json("data/0601/cntbn.geojson");
    const pop_density_promise = d3.csv("data/0601/pop_density_nuts3.csv");

    Promise.all([
        gra_promise,
        nutsrg_promise,
        nutsbn_promise,
        cntrg_promise,
        cntbn_promise,
        pop_density_promise,
    ])
        .then(function (data) {
            //data array to individual variables
            const [gra, nutsrg, nutsbn, cntrg, cntbn, pop_density] = data;

            console.log("Data loaded successfully.");

            addpop(nutsrg, pop_density);

            drawmap(gra, nutsrg, nutsbn, cntrg, cntbn);
        })
        .catch(function (error) {
            console.error("Error loading data:", error);
        });
}

//add population density data
function addpop(nutsrg, pop_density) {
    console.log("Processing NUTS3 features to add population density data...");

    const popDensityIndex = d3.index(pop_density, (d) => d.geo, (d) => d.TIME_PERIOD);

    nutsrg.features.forEach(function (feature) {
        const geo_id = feature.properties.id;

        const geoData = popDensityIndex.get(geo_id);
        if (geoData) {
            const yearData = geoData.get(ctx.YEAR);
            if (yearData) {
                feature.properties.density = +yearData.OBS_VALUE;
            } else {
                feature.properties.density = null;
                console.log(`No density data for NUTS3 region ${geo_id} in year ${ctx.YEAR}`);
            }
        } else {
            feature.properties.density = null;
            console.log(`No density data for NUTS3 region ${geo_id}`);
        }
    });

    console.log("Population density data added to NUTS3 features.");
}

function drawmap(graticule, nutsrg, nutsbn, cntrg, cntbn) {
    console.log("Drawing the map...");

    ctx.proj = d3.geoIdentity()
        .reflectY(true)
        .fitSize([ctx.MAP_W, ctx.MAP_H], graticule);

    const geoPathGen = d3.geoPath().projection(ctx.proj);

    const svg = d3.select("#mapContainer svg");

    const densityValues = nutsrg.features
        .map(d => d.properties.density)
        .filter(d => d != null && d > 0);

    const densityMin = d3.min(densityValues);
    const densityMax = d3.max(densityValues);

    console.log(`Density Min: ${densityMin}, Density Max: ${densityMax}`);

    const colorScale = d3.scaleSequentialLog(d3.interpolateViridis)
        .domain([densityMin, densityMax]);

    console.log("Drawing NUTS3 areas with color based on density...");

    const nutsAreaGroup = svg.append("g").attr("class", "nutsAreaGroup");

    nutsAreaGroup.selectAll("path")
        .data(nutsrg.features)
        .enter()
        .append("path")
        .attr("d", geoPathGen)
        .attr("class", "nutsArea")
        .style("fill", d => {
            const density = d.properties.density;
            if (density != null && density > 0) {
                return colorScale(density);
            } else {
                return "#ccc";
            }
        });

    console.log("Drawing NUTS3 borders...");

    const nutsBorderGroup = svg.append("g").attr("class", "nutsBorderGroup");

    nutsBorderGroup.selectAll("path")
        .data(nutsbn.features)
        .enter()
        .append("path")
        .attr("d", geoPathGen)
        .attr("class", "nutsBorder");

    console.log("Drawing country areas (outside EU)...");

    const countryAreaGroup = svg.append("g").attr("class", "countryAreaGroup");

    countryAreaGroup.selectAll("path")
        .data(cntrg.features)
        .enter()
        .append("path")
        .attr("d", geoPathGen)
        .attr("class", "countryArea");

    console.log("Drawing country borders (outside EU)...");

    const countryBorderGroup = svg.append("g").attr("class", "countryBorderGroup");

    countryBorderGroup.selectAll("path")
        .data(cntbn.features)
        .enter()
        .append("path")
        .attr("d", geoPathGen)
        .attr("class", "countryBorder");

    console.log("Map drawing complete.");
}

// NUTS data as JSON from https://github.com/eurostat/Nuts2json (translated from topojson to geojson)
// Density data from https://data.europa.eu/data/datasets/gngfvpqmfu5n6akvxqkpw?locale=en

/*
Lab 6 Assignment Submission

Name: Won Suk CHO
Course: M2 IoT

References:
https://d3js.org/d3-fetch
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
https://d3js.org/d3-scale-chromatic
https://d3js.org/d3-scale-chromatic/cyclical
https://d3js.org/d3-scale-chromatic/diverging
https://d3js.org/d3-scale-chromatic/sequential - CIVIDIS
https://tinyurl.com/DataVisualization2024
*/