var createPlot = function () {
    vlSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "background": "rgb(250, 250, 250)",
        "layer": [
            //1
            {
                "data": {
                    "url": "data/0602/us-10m.json",
                    "format": { "type": "topojson", "feature": "states" }
                },
                //US map
                "projection": { "type": "albersUsa" },
                //draw states
                "mark": {
                    "type": "geoshape",
                    "stroke": "lightgray",
                    "fill": "white"
                }
            },
            //2
            {
                "data": {
                    "url": "data/0602/airports.json",
                    "format": { "type": "json" }
                },
                //filter data
                "transform": [
                    //lookup transform
                    {
                        "lookup": "state",  //match data
                        "from": {
                            "data": {
                                "url": "data/0602/states_tz.csv",
                                "format": { "type": "csv" }
                            },
                            "key": "State",     //match csv
                            "fields": ["TimeZone"]  //receive
                        }
                    },
                    //filter IATA code
                    {
                        "filter": "!test(/\\d/, datum.iata) && datum.TimeZone != null"
                    }
                ],
                "projection": { "type": "albersUsa" },
                //point for airpotrs
                "mark": {
                    "type": "point"
                },
                "encoding": {
                    "longitude": { "field": "longitude", "type": "quantitative" },
                    "latitude": { "field": "latitude", "type": "quantitative" },
                    "color": {
                        "field": "TimeZone",
                        "type": "nominal",
                        "legend": null,
                    },
                    "size": {
                        "value": 10
                    }
                }
            }
        ]
    };

    vlOpts = { width: 1000, height: 600, actions: false };

    vegaEmbed("#map", vlSpec, vlOpts).then(function (result) {
        console.log("Rendering successful");
        console.log("Specification:", vlSpec);
    }).catch(function (error) {
        console.error("Error:", error);
    });
};

/*
Lab 6 Assignment Submission

Name: Won Suk CHO
Course: M2 IoT

References:
https://vega.github.io/vega-lite/docs/layer.html
https://vega.github.io/vega-lite/examples/geo_layer.html
https://vega.github.io/vega-lite/docs/lookup.html
https://tinyurl.com/DataVisualization2024
*/