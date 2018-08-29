function plotDensityEstimate() {
    var numGenerations = +global_data.epsilon_schedule.length;
    var numModels = +global_data.models.length;
    var numParticles = +global_data.particles;
    var weights = [];

    var processed_generations = [];

    var non_constant_params = model.params.filter(function(d){ return d.type !== "constant" });

    var a = +document.getElementById("density_width").value;
    var num_points = +document.getElementById("density_points").value;

    if (isNaN(a) || a == 0){ a = 0.1; }
    if (isNaN(num_points) || num_points == 0){ num_points = 10; }

    // Values at which to estimate p.d.f. for each parameter
    var vals = [];
    for (i in non_constant_params) {
        var p = non_constant_params[i];
        vals[p.name] = linspace(p.min, p.max, num_points);
    }


    var densityPoints = []; // the actual data we will plot

    for (var generation = 1; generation <= numGenerations; generation++) {
        if (global_data.epsilon_schedule[generation - 1] > max_distance) {
            continue;
        }
        getWeights(generation);
    }


    function getWeights(generation) {

        var dataURL = path + "/results_" + model.model_name + "/Population_" + generation.toString() + "/data_Weights" + generation.toString() + ".txt";

        d3.text(dataURL, function (error, rawData) {
            if (error) {
                console.log("Error getting " + dataURL);
                throw error;
            } else {
                var parsedData = d3.dsv(" ", "text/plain").parseRows(rawData);
                parsedData = parsedData.map(function (d) {
                    return +d[0]
                });

                weights[generation] = parsedData;

                getParams(generation, parsedData);
            }
        });
    }

    function linspace(a,b,n) {
        if(typeof n === "undefined") n = Math.max(Math.round(b-a)+1,1);
        if(n<2) { return n===1?[a]:[]; }
        var i,ret = Array(n);
        n--;
        for(i=n;i>=0;i--) { ret[i] = (i*b+(n-i)*a)/n; }
        return ret;
    }

    function getParams(generation, weights) {

        var dataURL = path + "results_" + modelName + "/Population_" + (generation) + "/data_Population" + (generation) + ".txt";
        var estimate = [];


        d3.text(dataURL, function (error, rawData) {
            if (error) throw error;

            var n = non_constant_params.length;

            parsedData = d3.dsv(" ", "text/plain")
                .parseRows(rawData)
                .map(function (d, ind) {
                    var values = {};

                    for (var i = 0; i < n; i++) {
                        var param = non_constant_params[i];
                        values[param.name] = +d[param.column];

                        for (var j = 0; j < num_points; j++) {
                            var x = vals[param.name][j] - values[param.name];
                            if (!estimate[param.name]){ estimate[param.name] = Array(num_points).fill(0); }

                            var contribution = 1/(a * Math.sqrt(Math.PI)) * Math.exp( - Math.pow(x/a, 2) );
                            estimate[param.name][j] += (1/numParticles) * weights[ind] * contribution;
                        }
                    }

                    values.weight = weights[ind];
                    return values;
                });

                    for (p in estimate){
                        for (var j = 0; j < num_points; j++) {
                            densityPoints.push({ x: vals[p][j], y: estimate[p][j], parameterName: p, generation: generation })
                        }
                    }

                    processed_generations.push(generation);
                    if (processed_generations.length == numGenerations){
                        draw();
                    }
        });
    }


    function draw() {
        // Build graphic
        var paddedWidth = width,
            size = 230,
            padding = 100,
            innerWidth = paddedWidth - padding;


        var yScales = [], yAxes = [];
        for (var i = 0; i < non_constant_params.length; i++) {

            var densities = densityPoints.filter(function (d) {
                return d.parameterName === non_constant_params[i].name
            }).map(function (d) {
                return d.y;
            });
            var max_density = Math.max.apply(Math, densities);


            tmp = d3.scale.linear()
                .range([size - padding / 2, padding / 2])
                .domain([0, max_density]);
            yScales[i] = tmp;

            yAxes[i] = d3.svg.axis()
                .scale(yScales[i])
                .orient("left")
                .ticks(6);

        }

        var xScales = [], xAxes = [];
        for (var i = 0; i < non_constant_params.length; i++) {


            tmp = d3.scale.linear()
            .range([padding / 2, innerWidth - padding / 2])
            .domain([+non_constant_params[i].min, +non_constant_params[i].max]);

            xScales[i] = tmp;

            xAxes[i] = d3.svg.axis()
                .scale(xScales[i])
                .orient("bottom")
                .ticks(6);
        }


        var color = d3.scale.category20c();

        d3.select("#density").select('svg').remove();
        var svg = d3.select("#density").append('svg')
            .attr("width", paddedWidth)
            .attr("height", size * non_constant_params.length + padding)
            .append("g")
            .attr("transform", "translate(" + padding + "," + padding / 2 + ")");


        svg.selectAll(".cell")
            .data(non_constant_params)
            .enter().append("g")
            .attr("class", "cell")
            // Swapped column order by changing (n - d.i - 1) to (d.i)
            .attr("transform", function (d, i) {
                return "translate(0," + i * size + ")";
            })
            .attr("id", function (d) {
                return d.name;
            })
            .each(plot);


        function plot(param) {

        var paramName = param.name;

            // filter to remove other params
            var thisParam = densityPoints.filter(function (d) {
                return d.parameterName === paramName
            });

            var cell = d3.select("#" + paramName);

            var paramIndex = non_constant_params.indexOf(param);

            var x = xScales[paramIndex];
            var xAxis = xAxes[paramIndex];

            var y = yScales[paramIndex];
            var yAxis = yAxes[paramIndex];


            // Add points
            var points = cell.selectAll("circle")
                .data(thisParam)
                .enter()
                .append('circle')
                .attr("cx", function (d, i) {
                    return x(d.x);
                })
                .attr("cy", function (d) {
                    return y(d.y);
                })
                .attr("r", 5)
                .attr("fill", function (d) {
                    return generationColor(d.generation - 1);
                });

              points.append("svg:title")
                  .text(function (d, i) {
                      return "(" + d.x + ", " + d.y + ")";
                  }); // TODO: add 1 to i?


            // add axis
            cell.append("g")
                .attr("class", "y densityplot-axis")
                .attr("transform", "translate(" + padding / 2 + ",0)").call(yAxis);

            // x-axis and label
            cell.append("g")
                .attr("class", "x densityplot-axis")
                .attr("transform", "translate(0," + (size - padding / 2) + ")").call(xAxis);

            cell.append("text")
                .attr("transform", "rotate(-90,0,0) translate(-" + (size + padding) / 2 + ", 0)") // TODO: fiddle with this
                .text(function (d) {
                    return d.name;
                });


            // add lines
            for (var i = 0; i < numGenerations; i++) {
                var line = d3.svg.line()
                    .x(function (d) {
                        return x(d.x);
                    })
                    .y(function (d) {
                        return y(d.y);
                    });

                var subdata = thisParam.filter(function(d){ return d.generation === (i+1) })
                    .sort(function(d1, d2){ return d1.x - d2.x;  });

                cell.append("svg:path").attr("d", line(subdata))
                    .attr("fill", "none")
                    .attr("stroke", generationColor(i))
                    .attr("stroke-width", "1px")
                    .attr("fill", "none")
                    .classed("density-line", "true");
            }


        }
    }

    return {draw: draw}


}