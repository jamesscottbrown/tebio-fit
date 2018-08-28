
function rangeNotNA(list){
    if (!list){ list = []; }

    var min = Infinity, max = -Infinity;
    for (var i=0; i < list.length; i++){
        if (list[i] === "NA"){ continue; }
        var element = parseFloat(list[i]);

        if (element < min){ min = element; }
        if (element > max){ max = element; }
    }
    return [min, max];
}

function plotTimeSeries(i) {

    var dataURL = path + "traj_Population" + i + ".txt";

    var subsampleRate = parseInt(document.getElementById("subsampling").value);
    if (isNaN(subsampleRate)){
        subsampleRate = 1;
    }

    filtered_times = global_data.times.filter(function(value, index) {
        return (index % subsampleRate) === 0;
    });



    d3.text(dataURL, function (error, rawData) {
        if (error) throw error;

        // Filter out results from different model
        var modelIndex;
        for (var i = 0; i < global_data.models.length; i++) {
            if (global_data.models[i].model_name === model.model_name) {
                modelIndex = i;
            }
        }

        var parsedData = d3.dsv(" ", "text/plain")
            .parseRows(rawData)
            .filter(function (d) {
                return +d[2] === modelIndex;
            });

        // Rows encode values: particle number, replicate number, model id, species id, then series

        var n = model.fit.length;
        cleanedData = [];
        var minVal = [], maxVal = [];
        for (var i = 0; i < parsedData.length; i++) {
            raw = parsedData[i];

            tmp = {};
            tmp["particle_number"] = +raw[0];
            tmp["replicate"] = +raw[1];
            tmp["modelIndex"] = +raw[2];
            tmp["speciesIndex"] = +raw[3];
            tmp["speciesName"] = model.fit[tmp["speciesIndex"]];

            tmp["data"] = raw.slice(4);
            tmp["data"].length = global_data.times.length; // will truncate to remove spurious "" at end of line

            tmp["data"] = tmp["data"].filter(function(value, index) {
                return (index % subsampleRate) === 0;
            });

            // If necessary, update count of species, and extend array of max/min values
            var speciesIndex = tmp["speciesIndex"];
            if (minVal.length <= speciesIndex){
                minVal[speciesIndex] = Infinity;
                maxVal[speciesIndex] = -Infinity;
            }
            if (speciesIndex >= n){
                n = speciesIndex + 1;
            }

            cleanedData[i] = tmp;

            var thisMin = Math.min.apply(null, tmp.data);
            if (thisMin < minVal[speciesIndex] ) {
                minVal[speciesIndex] = thisMin;
            }
            var thisMax = Math.max.apply(null, tmp.data);
            if (thisMax > maxVal[speciesIndex]) {
                maxVal[speciesIndex] = thisMax;
            }
        }

        // Expand out model.fit array if necessary (because it was specified as 'None')
        if (model.fit.length < n){
            for (var i = 0; i < n; i++){
                model.fit[i] = "Species" + i.toString();
            }

            for (var i = 0; i < parsedData.length; i++) {
                cleanedData[i]["speciesName"] = model.fit[cleanedData[i]["speciesIndex"]];
            }
        }

        // Expand range to include time-series
        for (var i = 0; i < n; i++) {
            tmp = rangeNotNA( global_data.measurements[i] );
            if (tmp[0] < minVal[i]){ minVal[i] = tmp[0]; }
            if (tmp[1] > maxVal[i]){ maxVal[i] = tmp[1]; }
        }


        // We need to re-number
        // Some particle numbers are missing, as the corresponding particles were rejected.
        // We need to re-number so we can match up with the trajectories in traj_Population*.txt
        // Need to be careful, as there is a row in this file for each concentration for each particle.
        var prev = cleanedData[0]["particle_number"];
        var np = 0;
        for (var i = 0; i < cleanedData.length; i++) {
            if (cleanedData[i]["particle_number"] !== prev) {
                np = np + 1;
                prev = cleanedData[i]["particle_number"];
            }
            cleanedData[i]["particle_number_shifted"] = np;

        }

        var endTime = filtered_times[ filtered_times.length - 1 ];


        // Build graphic
        var paddedWidth = width,
            size = 230,
            padding = 100,
            innerWidth  = paddedWidth - padding;

        var x = d3.scale.linear()
            .range([padding / 2, innerWidth - padding / 2])
            .domain([0, endTime ]);

        var yScales = [], yAxes = [];
        for (var i = 0; i < n; i++) {
            tmp = d3.scale.linear()
                .range([size - padding / 2, padding / 2])
                .domain([minVal[i], maxVal[i]]);
            yScales[i] = tmp;

            yAxes[i] = d3.svg.axis()
                .scale(yScales[i])
                .orient("left")
                .ticks(6);

        }

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .ticks(6);


        var color = d3.scale.category20c();

        d3.select("#timeseries").select('svg').remove();
        var svg = d3.select("#timeseries").append('svg')
            .attr("width", paddedWidth)
            .attr("height", size * n + padding)
            .append("g")
            .attr("transform", "translate(" + padding + "," + padding / 2 + ")");


        svg.selectAll(".cell")
            .data(model.fit)
            .enter().append("g")
            .attr("class", "cell")
            // Swapped column order by changing (n - d.i - 1) to (d.i)
            .attr("transform", function (d, i) {
                return "translate(0," + i * size + ")";
            })
            .attr("id", function (d) {
                return d.replace('+', '_');
            })
            .each(plot);



        // construct reference lines
        for (var species=0; species < n; species++){

            var y = yScales[species];

            var refLineData = [];

            var measurements = [];
            if (global_data.measurements.length > species){
                measurements = global_data.measurements[species];
            }

            for (var t=0; t < measurements.length; t++){
                var tmp=[];
                tmp["x"] = filtered_times[t];
                tmp["y"] = measurements[t];

                if ( tmp["y"] !== "NA"){
                    refLineData[ refLineData.length ] = tmp;
                }

            }


            var cell = d3.select("#timeseries")
                .select('svg')
                .select( "#" + model.fit[species].replace('+', '_') );

            var group = cell.append("g")
                .attr("class", "refline");

            group.selectAll("path")
                .data(refLineData)
                .enter()
                .append("path")
                .attr("d", d3.svg.symbol().type('cross') )
                .attr("transform", function(d){ return "translate (" + x(d.x) + ", " + y(d.y) + ")";}  )
                .fill("grey");

            group.selectAll("path").append("title")
                .text(function (d) {
                    return "(" + d.x + ", " + d.y + ")";
                });
        }

        function plot(speciesName){
            // filter to remove other species
            var thisSpecies = cleanedData.filter(function (d) {
                return d.speciesName === speciesName
            });

            var cell = d3.select("#" + speciesName.replace('+', '_'));

            var speciesIndex = model.fit.indexOf(speciesName);
            var y = yScales[ speciesIndex ];
            var yAxis = yAxes[ speciesIndex ];

            // One group per time series
            var groups = cell.selectAll("g")
                .data(thisSpecies)
                .enter()
                .append("g")
                .attr("class", "trajectory");

            // Add points
            var points = groups.selectAll("circle")
                .data(function (d, i) {
                    // Here 'raw' is the vector of measurements from one simulation
                    // Form new array, where each element still corresponds to one measurement,
                    // but is an object that also records the identity of the simulation form which it comes
                    // (alternatively, could style the parent group instead?)
                    var raw = groups.data()[i].data;
                    var process = [];
                    for (var j = 0; j < raw.length; j++) {
                        tmp = [];
                        tmp["series"] = i;
                        tmp["y"] = raw[j];
                        process[j] = tmp;

                    }
                    return process;
                })
                .enter()
                .append('circle')
                .attr("cx", function (d, i) {
                    return x(filtered_times[i]);
                })
                .attr("cy", function (d) {
                    return y(d.y);
                })
                .attr("r", 5)
                .attr("fill", function (d) {
                    return color(d.series);
                });

            points.append("svg:title")
                .text(function (d, i) {
                    return "(" + filtered_times[i] + ", " + d.y + ")";
                }); // TODO: add 1 to i?


            // add line
            var line = d3.svg.line()
                .x(function (d) {
                    return x(filtered_times[d.x]);
                })
                .y(function (d) {
                    return y(d.y);
                });
            //.y( function (d){ return y(d.y); });

            groups.append("path")
                .attr("d", function (d) {
                    var processed = [];
                    for (var j = 0; j < d.data.length; j++) {
                        tmp = [];
                        tmp["x"] = j;
                        tmp["y"] = d.data[j];
                        if (d.data[j] === "") {
                            continue;
                        }
                        processed[j] = tmp;
                    }
                    return line(processed);
                })
                .attr("class", "timeseries-line")
                .style('stroke', function (d, i) {
                    return color(i);
                });

            // add axis
            cell.append("g")
                .attr("class", "y timeseries-axis")
                .attr("transform", "translate(" + padding / 2 + ",0)").call(yAxis);

            // x-axis and label
            cell.append("g")
                .attr("class", "x timeseries-axis")
                .attr("transform", "translate(0," + (size - padding / 2) + ")").call(xAxis);

            cell.append("text")
                .attr("transform", "rotate(-90,0,0) translate(-" + (size + padding) / 2 + ", 0)") // TODO: fiddle with this
                .text(function (d) {
                    return d;
                });

        }

    });
}

function highlightTimeSeries() {

    var unSelected = d3.select("#splom").select("svg").select(".cell").selectAll(".not-selected").data();
    var unselectedParticles = [];
    for (var i = 0; i < unSelected.length; i++) {
        unselectedParticles[i] = Number(unSelected[i].particle_number);
    }


// select all lines
    d3.select("#timeseries").select("svg").selectAll(".trajectory").classed("trajectory-not-selected", false);

// unselect the ones that are unselected
    d3.select("#timeseries").select("svg").selectAll(".trajectory").classed("trajectory-not-selected", function (d) {
        return unselectedParticles.indexOf(d.particle_number_shifted) !== -1;

    });
}