function plotErrors(paddedWidth, redraw){

    var numGenerations = +global_data.epsilon_schedule.length;
    var numModels = +global_data.models.length;
    var numParticles = +global_data.particles;

    // If drawing for the first time, create the 'max distance to plot' drop-down menu
    // Otherwise, adjust y-axis to selected value
    var max_distance = +global_data.epsilon_schedule[0];
    if (redraw === false) {
        d3.select("#max_distance")
            .selectAll("option")
            .data(global_data.epsilon_schedule)
            .enter()
            .append("option")
            .text(function (d) {
                return d;
            })
            .attr("value", function (d) {
                return d;
            });
    } else {
        var e = document.getElementById("max_distance");
        max_distance = +e.options[e.selectedIndex].value;
    }

    // Build graphic
    var height = 500,
        padding = 75,
        //paddedWidth = width + padding
        width  = paddedWidth - padding;

    // x-axis ranges from 1 to numParticles
    var x = d3.scale.linear()
        .range([padding / 2, width - padding / 2])
        .domain([0, numParticles ]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(6);


    // y axis ranges from 0 to max epsilon
    var y = d3.scale.linear()
        .range([height - padding / 2, padding / 2])
        .domain([0, max_distance]);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .ticks(6);

    // same color scale as in bar chart. TODO: share the scale object
    var modelColor = d3.scale.category10()
            .domain([1, numModels]);


    // create SVG
    d3.select("#errors").select('svg').remove();
    var svg = d3.select("#errors").append('svg')
        .attr("width", paddedWidth)
        .attr("height", height + padding)
        .append("g")
        .attr("transform", "translate(" + padding + "," + padding / 2 + ")");


    // add y-axis and label
    svg.append("g")
        .attr("class", "y distanceplot-axis")
        .attr("transform", "translate(" + padding / 2 + ",0)").call(yAxis);

    svg.append("text")
        .attr("transform", "rotate(-90,0,0) translate(-" + (height + padding) / 2 + ", 0)") // TODO: fiddle with this
        .text("Distance")
        .classed("axis-title", true);


    // add x-axis and label
    svg.append("g")
        .attr("class", "x distanceplot-axis")
        .attr("transform", "translate(0," + (height - padding / 2) + ")").call(xAxis);

    svg.append("text")
        .attr("transform", "translate(" + (width/2) + "," + (height)  +  ")") // TODO: fiddle with this
        .text("Particle Rank")
        .classed("axis-title", true);


    for (var generation = 1; generation <= numGenerations; generation++){
        if (global_data.epsilon_schedule[generation-1] > max_distance ){ continue; }
        processLine(generation);

        // plot reference line
        var reflineY = y(global_data.epsilon_schedule[generation-1]);
        svg.append("line")
            .attr("x1", x(0))
            .attr("y1", reflineY)
            .attr("x2", x(numParticles))
            .attr("y2", reflineY)
            .attr("stroke", "steelblue")
            .attr("stroke-width", "1px")
            .attr("stroke-dasharray", "5,5")
            .classed("distance-refline", true)
            .attr("id", "distance-refline-" + (generation-1))
            .style("stroke", generationColor(generation-1))

    }


        var brush = d3.svg.brush()
            .x(x)
            .y(y)
            .on("brushstart", brushstart)
            .on("brush", brushmove)
            .on("brushend", brushend);

        var brushCell;

        // Clear the previously-active brush, if any.
        function brushstart(p) {
            brushCell = this;
        }

        // Highlight the selected circles.
        function brushmove(p) {
            var e = brush.extent();

            svg.selectAll(".epsilon-points").classed("unselected", function (d) {
                return e[0][0] > d.particleRank
                    || d.particleRank > e[1][0]
                    || e[0][1] > d.error
                    || d.error > e[1][1]
                    || (d.epsilon !== global_data.epsilon_schedule[selectedEpsilon]);
            });


            var selected_particle_numbers = svg.selectAll(".epsilon-points").filter(function (d) {
                return e[0][0] < d.particleRank
                    && d.particleRank < e[1][0]
                    && e[0][1] < d.error
                    && d.error < e[1][1]
                    && (d.epsilon == global_data.epsilon_schedule[selectedEpsilon]);
            })
                .data()
                .map(function(d){ return d.particleNumber});
            highlightPoints(selected_particle_numbers);

        }

        // If the brush is empty, select all circles.
        function brushend() {
            if (brush.empty()) deselectAll();
            highlightTimeSeries();
        }

        svg.call(brush);





    function processLine(generation){

        var dataURL = path + "distance_Population" + generation.toString() + ".txt";

        d3.text(dataURL, function (error, rawData) {
            if (error) throw error;

            rawData = rawData.replace(/\[ /g, '').replace(/\[/g, '').replace(/\]/g, '');
            var parsedData = d3.dsv(" ", "text/plain").parseRows(rawData);
            parsedData = parsedData.map(function(d){ return [+d[0], +d[1], +d[2], +d[3]] });

            // filter to get particles for this model only
            for (var modelNum = 0; modelNum < numModels; modelNum++) {
                var thisModelData = parsedData.filter(function (d) {
                    return d[3] === modelNum;
                });

                // reformat data
                var filteredData = [];
                for (var i=0; i < thisModelData.length; i++){
                    var distance = thisModelData[i][2];
                    var epsilon = global_data.epsilon_schedule[generation-1];
                    filteredData[i] = {error: +distance, modelNum: modelNum, epsilon: epsilon, particleNumber: i};
                }

                filteredData.sort(function(a,b){ return a.error - b.error; });
                filteredData = filteredData.map(function(d, i){
                    d.particleRank = i;
                    return d;
                });

                // plot
                plotLine(filteredData, generation);
            }
        });

    }

    function plotLine(filteredData, generation){

        if (!filteredData || filteredData.length == 0){ return; }

        var group = svg.append("g")
            .attr("class", "refline")
            .attr("stroke", modelColor(filteredData[0].modelNum+1))
            .attr("fill", modelColor(filteredData[0].modelNum+1));

        var points = group.selectAll("path")
            .data(filteredData)
            .enter()
            .append("path")
            .attr("d", d3.svg.symbol().type('circle') )
            .attr("transform", function(d, i){ return "translate (" + x(d.particleRank) + ", " + y(d.error) + ")";}  )
            .classed("epsilon" + filteredData[0].epsilon, "true" )
            .classed("epsilon-points", "true" );

        points.on("mouseover",
            function (d) {
                svg.selectAll(".epsilon-points")
                    .classed("unselected", function (d2) {
                        return d.epsilon !== d2.epsilon;
                    });

                svg.selectAll(".distance-refline").classed("unselected", true);
                var ind = global_data.epsilon_schedule.indexOf(d.epsilon);
                svg.selectAll("#distance-refline-" + ind).classed("unselected", false);
            })
            .on("mouseout",
                function () {
                    svg.selectAll(".epsilon-points").classed("unselected", false);
                    svg.selectAll(".distance-refline").classed("unselected", false);
                });


        group.selectAll("path").append("title")
            .text(function (d) {
                return "epsilon =" + d.epsilon + ", error = " + d.error;
            });


        var line = d3.svg.line()
            // assign the X function to plot our line as we wish
            .x(function(d,i) {
                return x(d.particleRank);
            })
            .y(function(d) {
                return y(d.error);
            });

        svg.append("svg:path").attr("d", line(filteredData))
            .attr("fill", "none")
            .attr("stroke", generationColor(generation-1))
            .attr("stroke-width", "1px")
            .attr("fill", "none")
            .classed("epsilon-line", "true" );
    }
}
