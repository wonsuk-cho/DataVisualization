// ex07.js

const ctx = {
    WIDTH: 860,
    HEIGHT: 800,
    mapMode: false,
    airport_vertices: [], // Holds processed airport data
    route_edges: [],      // Holds processed flight data
    usStatesData: null,   // Holds US states GeoJSON data
    svg: null             // Holds the SVG element
};

const ALBERS_PROJ = d3.geoAlbersUsa().translate([ctx.WIDTH / 2, ctx.HEIGHT / 2]).scale([1000]);

// Initialize the force simulation
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink()
        .id(function (d) { return d.id; })
        .distance(5).strength(0.08))
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(ctx.WIDTH / 2, ctx.HEIGHT / 2));

function createGraphLayout() {
    console.log("Creating graph layout...");

    const svg = ctx.svg;

    // Initialize nodes' positions to map positions
    // This ensures that nodes start from the map positions
    ctx.airport_vertices.forEach(function(d) {
        d.x = d.xmap;
        d.y = d.ymap;
    });

    // Remove any existing groups (if re-running)
    svg.selectAll("g#routeG").remove();
    svg.selectAll("g#airportG").remove();

    // Append g#routeG and set opacity
    const routeG = svg.append("g")
        .attr("id", "routeG")
        .style("opacity", 1); // Initially visible

    // Append g#airportG
    const airportG = svg.append("g")
        .attr("id", "airportG");

    // ** Replace <line> elements with <path> elements **
    // Bind data to paths in routeG
    const paths = routeG.selectAll("path")
        .data(ctx.route_edges)
        .enter()
        .append("path")
        .attr("stroke-width", 0.1) // Reduced stroke-width for thinner lines
        .attr("stroke", "#999")
        .attr("fill", "none"); // Paths should not be filled

    // Bind data to circles in airportG
    const circles = airportG.selectAll("circle")
        .data(ctx.airport_vertices)
        .enter()
        .append("circle")
        .attr("r", 5)
        .attr("stroke", "#333")
        .attr("stroke-width", 1);

    // Create color scale for degree centrality
    console.log("Creating color scale for degree centrality...");

    // Compute log-transformed degrees
    const degrees = ctx.airport_vertices.map(d => d.degree);
    const logDegrees = degrees.map(d => Math.log(d));

    const minLogDegree = d3.min(logDegrees);
    const maxLogDegree = d3.max(logDegrees);

    console.log(`Log degree centrality ranges from ${minLogDegree.toFixed(2)} to ${maxLogDegree.toFixed(2)}`);

    const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([minLogDegree, maxLogDegree]); // Adjust domain for color mapping

    // Fill node circles based on degree centrality
    circles
        .attr("fill", d => colorScale(Math.log(d.degree)));

    // Associate nodes and links to the simulation
    simulation.nodes(ctx.airport_vertices)
        .on("tick", simStep);

    simulation.force("link")
        .links(ctx.route_edges);

    // Append title to each node's circle
    circles.append("title")
        .text(d => `${d.city} (${d.id})`);

    // Add drag behaviors to circles
    circles.call(d3.drag()
        .on("start", (event, d) => startDragging(event, d))
        .on("drag", (event, d) => dragging(event, d))
        .on("end", (event, d) => endDragging(event, d)));

    console.log("Graph layout created.");
}

function createMap() {
    console.log("Creating map...");
    const svg = ctx.svg;

    // Append g#us_map if it doesn't exist
    let usMapG = svg.select("g#us_map");
    if (usMapG.empty()) {
        usMapG = svg.append("g")
            .attr("id", "us_map")
            .style("opacity", 0); // Set opacity to 0, as we show the node-link diagram by default
    }

    // Create geoPath generator
    const geoPathGenerator = d3.geoPath().projection(ALBERS_PROJ);

    // Bind the GeoJSON features to <path> elements
    usMapG.selectAll("path")
        .data(ctx.usStatesData.features)
        .enter()
        .append("path")
        .attr("d", geoPathGenerator)
        .attr("class", "state");

    console.log("Map created.");
}

function switchVis(showMap) {
    const duration = 500;

    if (showMap) {
        console.log("Switching to map visualization...");
        // Stop the simulation to prevent nodes from being moved by the force simulation
        simulation.stop();
        console.log("Simulation stopped.");

        // Fade out the links
        console.log("Fading out links...");
        d3.select("g#routeG")
            .transition()
            .duration(duration)
            .style("opacity", 0)
            .on("end", function () {
                console.log("Links faded out, updating paths to map positions.");
                // Once faded out, update the paths to the map positions
                updatePaths('map');

                // Fade the links back in
                console.log("Fading in links at map positions...");
                d3.select("g#routeG")
                    .transition()
                    .duration(duration)
                    .style("opacity", 1)
                    .on("end", function () {
                        console.log("Links faded in at map positions.");
                    });
            });

        // Fade the map in
        console.log("Fading in map...");
        d3.select("g#us_map")
            .transition()
            .duration(duration)
            .style("opacity", 1)
            .on("end", function () {
                console.log("Map faded in.");
            });

        // Animate nodes to their map positions
        console.log("Animating nodes to map positions...");
        d3.selectAll("#airportG circle")
            .transition()
            .duration(duration)
            .attr("cx", d => d.xmap)
            .attr("cy", d => d.ymap)
            .on("end", function (event, d) {
                console.log(`Node ${d.id} moved to map position.`);
            });

    } else {
        console.log("Switching to node-link diagram...");

        // Stop the simulation to prevent nodes from being moved during the transition
        simulation.stop();
        console.log("Simulation stopped.");

        // **Step 1: Fade out the curves or lines first**
        console.log("Fading out links...");
        d3.select("g#routeG")
            .transition()
            .duration(duration)
            .style("opacity", 0)
            .on("end", function () {
                console.log("Links faded out.");

                // **Step 2: Move the nodes or dots**
                // Fix nodes' positions to prevent simulation forces during transition
                ctx.airport_vertices.forEach(function (d) {
                    d.fx = d.x;
                    d.fy = d.y;
                });
                console.log("Nodes' positions fixed for transition.");

                console.log("Animating nodes to node-link positions...");
                const nodeTransition = d3.selectAll("#airportG circle")
                    .transition()
                    .duration(duration)
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);

                // Fade out the map in parallel with node movement
                console.log("Fading out map...");
                d3.select("g#us_map")
                    .transition()
                    .duration(duration)
                    .style("opacity", 0)
                    .on("end", function () {
                        console.log("Map faded out.");
                    });

                // **Step 3: After nodes have moved, apply the lines and curves for node links**
                nodeTransition.on("end", function () {
                    console.log("Nodes moved to node-link positions.");

                    updatePaths('force');
                    console.log("Paths updated to node-link positions.");

                    // **Step 4: Fade in the links to complete the node-link view**
                    console.log("Fading in links at node-link positions...");
                    d3.select("g#routeG")
                        .transition()
                        .duration(duration)
                        .style("opacity", 1)
                        .on("end", function () {
                            console.log("Links faded in at node-link positions.");

                            // **Release the nodes and restart the simulation**
                            ctx.airport_vertices.forEach(function (d) {
                                d.fx = null;
                                d.fy = null;
                            });
                            console.log("Nodes released.");
                        });
                });
            });
    }
}


function createViz() {
    console.log("Using D3 v" + d3.version);
    d3.select("body")
        .on("keydown", function (event, d) { handleKeyEvent(event); });
    let svgEl = d3.select("#main").append("svg");
    svgEl.attr("width", ctx.WIDTH);
    svgEl.attr("height", ctx.HEIGHT);
    ctx.svg = svgEl; // Store svgEl in ctx
    loadData();
}

function loadData() {
    console.log("Loading data");

    // Fetch and parse the data files using Promises
    const airportsPromise = d3.json("data/airports.json");
    const flightsPromise = d3.json("data/flights.json");
    const usStatesPromise = d3.json("data/us-states.geojson");

    Promise.all([airportsPromise, flightsPromise, usStatesPromise])
        .then(function (data) {
            const [airportsData, flightsData, usStatesData] = data;
            console.log("Data loaded successfully.");

            // Store us-states data in ctx for future use
            ctx.usStatesData = usStatesData;

            // Process the data
            processData(airportsData, flightsData);

        })
        .catch(function (error) {
            console.error("Error loading data:", error);
        });
}

/**
 * Processes the loaded data according to the specifications.
 * @param {Array} airportsData - Array of airport objects.
 * @param {Array} flightsData - Array of flight objects.
 */
function processData(airportsData, flightsData) {
    console.log("Processing data...");

    // Step 1: Filter out airports with IATA codes starting with a number
    console.log("Total airports before filtering:", airportsData.length);
    const validAirports = airportsData.filter(airport => !/^\d/.test(airport.iata));
    console.log("Airports after filtering invalid IATA codes:", validAirports.length);

    // Step 2: Filter out flights whose count < 2600
    console.log("Total flights before filtering:", flightsData.length);
    const validFlights = flightsData.filter(flight => flight.count >= 2600);
    console.log("Flights after filtering by count >= 2600:", validFlights.length);

    // Step 3: Build a set of connected airport IATA codes
    const connectedAirportCodes = new Set();
    validFlights.forEach(flight => {
        connectedAirportCodes.add(flight.origin);
        connectedAirportCodes.add(flight.destination);
    });
    console.log("Number of connected airports:", connectedAirportCodes.size);

    // Step 4: Filter validAirports to only include connected airports
    const connectedAirports = validAirports.filter(airport => connectedAirportCodes.has(airport.iata));
    console.log("Number of airports after removing unconnected airports:", connectedAirports.length);

    // Step 5: Create a mapping from IATA code to airport object
    const airportMap = new Map();
    connectedAirports.forEach(airport => {
        airport.degree = 0; // Initialize degree centrality
        airportMap.set(airport.iata, airport);
    });

    // Step 6: Compute degree centrality
    validFlights.forEach(flight => {
        const originAirport = airportMap.get(flight.origin);
        const destAirport = airportMap.get(flight.destination);
        if (originAirport && destAirport) {
            originAirport.degree += 1;
            destAirport.degree += 1;
        }
    });

    // Step 7: Prepare ctx.airport_vertices
    ctx.airport_vertices = connectedAirports.map(airport => {
        // Project the [longitude, latitude] to [xmap, ymap]
        let projected = ALBERS_PROJ([airport.longitude, airport.latitude]);
        let xmap, ymap;
        if (projected) {
            xmap = projected[0];
            ymap = projected[1];
        } else {
            // Handle SJU (San Juan) or any other airports that ALBERS_PROJ returns null
            console.warn(`Projection returned null for airport ${airport.iata}, assigning default coordinates.`);
            xmap = ctx.WIDTH - 50; // Assign to bottom-right corner
            ymap = ctx.HEIGHT - 50;
        }
        return {
            id: airport.iata,
            group: airport.state,       // Using state as group
            state: airport.state,
            city: airport.city,
            degree: airport.degree,
            latitude: airport.latitude,
            longitude: airport.longitude,
            xmap: xmap,
            ymap: ymap
            // Additional properties can be added here
        };
    });

    // Step 8: Prepare ctx.route_edges
    ctx.route_edges = validFlights.map(flight => {
        return {
            source: flight.origin,
            target: flight.destination,
            value: flight.count          // Using count as edge weight
        };
    });

    console.log("Number of vertices (airports):", ctx.airport_vertices.length);
    console.log("Number of edges (routes):", ctx.route_edges.length);

    // Proceed to create the map
    createMap();

    // Proceed to create the graph layout
    createGraphLayout();
}

function simStep() {
    // Code run at each iteration of the simulation
    // Updating the position of nodes and links

    // Update paths for curved links
    updatePaths('force');

    // Update nodes
    d3.selectAll("#airportG circle")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
}

/**
 * Updates the paths for the links (edges) based on the current positions of the nodes.
 * @param {string} mode - 'force' for force-directed positions, 'map' for map positions.
 */
function updatePaths(mode) {
    d3.selectAll("#routeG path")
        .attr("d", function (d) {
            let x1, y1, x2, y2;
            if (mode === 'force') {
                x1 = d.source.x;
                y1 = d.source.y;
                x2 = d.target.x;
                y2 = d.target.y;
            } else if (mode === 'map') {
                x1 = d.source.xmap;
                y1 = d.source.ymap;
                x2 = d.target.xmap;
                y2 = d.target.ymap;
            }

            // Compute the control point for the quadratic Bézier curve
            const dx = x2 - x1;
            const dy = y2 - y1;

            const distance = Math.sqrt(dx * dx + dy * dy);
            const rho = distance / (2 * Math.cos(Math.PI / 6));

            const alpha = Math.atan2(dy, dx);

            const angleOffset = Math.PI / 6; // 30 degrees in radians

            const cpX = x1 + rho * Math.cos(alpha + angleOffset);
            const cpY = y1 + rho * Math.sin(alpha + angleOffset);

            // Construct the path data
            return `M${x1},${y1} Q${cpX},${cpY} ${x2},${y2}`;
        });
}

function startDragging(event, node) {
    if (ctx.mapMode) { return; }
    if (!event.active) {
        simulation.alphaTarget(0.3).restart();
    }
    node.fx = node.x;
    node.fy = node.y;
}

function dragging(event, node) {
    if (ctx.mapMode) { return; }
    node.fx = event.x;
    node.fy = event.y;
}

function endDragging(event, node) {
    if (ctx.mapMode) { return; }
    if (!event.active) {
        simulation.alphaTarget(0);
    }
    // Commenting the following lines out will keep the
    // dragged node at its current location, permanently
    // unless moved again manually
    node.fx = null;
    node.fy = null;
}

function handleKeyEvent(e) {
    if (e.keyCode === 84) {
        // Hit 'T' key to toggle map mode
        toggleMap();
    }
}

function toggleMap() {
    ctx.mapMode = !ctx.mapMode;
    switchVis(ctx.mapMode);
}
