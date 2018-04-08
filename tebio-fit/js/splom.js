function paramTable() {
    // base on http://www.d3noob.org/2013/02/add-html-table-to-your-d3js-graph.html
    var table = d3.select('#paramTable').append("table");
    table.classed('table', true).classed('table-bordered', true); // apply bootstrap table themeing

    var tHead = table.append("thead");
    var tBody = table.append("tbody");


    var columns = [{"json_field": 'name', "display_name": "Parameter"},
        {"json_field": 'string', "display_name": "Distribution"}];

    tHead.append("tr")
        .selectAll("th")
        .data(columns)
        .enter()
        .append("th")
        .text(function (column) {
            return column.display_name;
        });


    // add rows
    var rows = tBody.selectAll("tr")
        .data(model.params)
        .enter()
        .append("tr");


    rows.selectAll("td")
        .data(function (row) {
            // callback must return data in format:
            // {name: "p5", type: "uniform", min: 0, max: 30}

            return columns.map(function (column) {
                return {column: column.display_name, value: row[column.json_field]};
            });

        })
        .enter()
        .append("td")
        .html(function (d) {
            return d.value;
        });

}

function selectEpsilon(d, i) {
    d3.select('#epsilons').selectAll("button").classed("active", false);
    d3.select(this).classed("active", true);

    plotSPLOM(form_url_for_population(i + 1), i);
    plotTimeSeries(i + 1);
}

function selectEpsilonFromSelection(button, i) {
    d3.select('#epsilons').selectAll("button").classed("active", false);
    button.classed("active", true);

    plotSPLOM(form_url_for_population(i + 1), i);
}


function form_url_for_population(i) {
    // returns path for the i'th population [1-indexed]
    return path + "results_" + modelName + "/Population_" + (i) + "/data_Population" + (i) + ".txt"
}

function listEpsilons() {
    d3.select('#epsilons').append("p")
        .selectAll("p") // create empty selection
        .data(global_data.epsilon_schedule)
        .enter().append("button")
        .text(function (d) {
            return d;
        })
        .classed("btn", true)
        .classed("btn-default", true)
        .on("click", selectEpsilon);
}

function toggleHistograms(){

    // toggle global drawHistograms boolean and button state
    drawHistograms = !drawHistograms;
    d3.select("#histogramButton").classed("active", drawHistograms );

    // simulate a click on the currently highlighted epsilon button to
    // force redraw of correct data
    var target = d3.select('#epsilons').select(".active")[0][0];

    var event = new MouseEvent('click', {
        'view': window,
        'bubbles': true,
        'cancelable': true
    });
    var canceled = !target.dispatchEvent(event);

}

function plotParcoords(parsedData, n, params){
    var subData = parsedData.map(function (d) {
        var values = {};
        for (var i = 0; i < n; i++) {
            var param = params[i];
            values[param.name] = (d[param.column]);
        }
        return values;
    });


    d3.select("#parcoords").node().innerHTML = "";
    var pc = d3.parcoords()("#parcoords")
        .data(subData)
        .alpha(0.2)
        .width(1200).height(500) // We need to set this, becuase parent DIV collapses to 0x0 when folded, causing drawing to fail
        .margin({top: 24, left: 0, bottom: 12, right: 0})
        .render()
        .reorderable()
        .brushMode("1D-axes");  // enable brushing
}

function getDomain(param){
    return d3.extent([+param.min, +param.max]);
}


function plotSPLOM(dataURL, generation) {
    var size = 230,
        padding = 20;

    var x = d3.scale.linear()
        .range([padding / 2, size - padding / 2]);

    var y = d3.scale.linear()
        .range([size - padding / 2, padding / 2]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(6);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .ticks(6);

    var generations = Array.apply(null, global_data.epsilon_schedule).map(function (_, i) {return i;});
    var color = d3.scale.category10().domain(generations);

    d3.text(dataURL, function (error, rawData) {
        if (error) throw error;

        var dsv = d3.dsv(" ", "text/plain");
        parsedData = dsv.parseRows(rawData);

        for (var i = 0; i < parsedData.length; i++) {
            parsedData[i]["particle_number"] = i;
            parsedData[i]["generation"] = generation;
        }

        var params = model.params.filter(function (x) {
                return x.type !== "constant";
            }),
            n = params.length;

        plotParcoords(parsedData, n, params);

        xAxis.tickSize(size * n);
        yAxis.tickSize(-size * n);

        var brush = d3.svg.brush()
            .x(x)
            .y(y)
            .on("brushstart", brushstart)
            .on("brush", brushmove)
            .on("brushend", brushend);

        d3.select("#splom").select("svg").remove();

        var svg = d3.select("#splom").append("svg")
            .attr("width", size * n + padding)
            .attr("height", size * n + padding)
            .append("g")
            .attr("transform", "translate(" + padding + "," + padding / 2 + ")");

        svg.selectAll(".x.axis")
            .data(params)
            .enter().append("g")
            .attr("class", "x axis")
            .attr("transform", function (d, i) {
                return "translate(" + (n - i - 1) * size + ",0)";
            })
            .each(function (d) {
                x.domain(getDomain(d));
                d3.select(this).call(xAxis);
            });

        svg.selectAll(".y.axis")
            .data(params)
            .enter().append("g")
            .attr("class", "y axis")
            .attr("transform", function (d, i) {
                return "translate(0," + i * size + ")";
            })
            .each(function (d) {
                y.domain(getDomain(d));
                d3.select(this).call(yAxis);
            });

        var cell = svg.selectAll(".cell")
            .data(cross(params, params))
            .enter().append("g")
            .attr("class", "cell")
            // Swapped column order by changing (n - d.i - 1) to (d.i)
            .attr("transform", function (d) {
                return "translate(" + (d.i) * size + "," + d.j * size + ")";
            });
        
        cell.each( function (d){
                if ( drawHistograms && d.x === d.y){
                    plotHist(d, this);
                } else {
                    plot(d, this);
                }
            });

        // Titles for the diagonal.
        cell.filter(function (d) {
            return d.i === d.j;
        }).append("text")
            .attr("x", padding)
            .attr("y", padding)
            .attr("dy", ".71em")
            .text(function (d) {
                return d.x.name;
            });

        cell.call(brush);

        function plotHist(p, thisCell){

            var cell = d3.select(thisCell);

            x.domain(getDomain(p.x));

            cell.append("rect")
                .attr("class", "frame")
                .attr("x", padding / 2)
                .attr("y", padding / 2)
                .attr("width", size - padding)
                .attr("height", size - padding);


            var values = [];
            for (var i=0; i < parsedData.length; i++){
                values[i] = parsedData[i][p.x.column];
            }

            var data = d3.layout.histogram()
                .bins(x.ticks(50))
                (values);

            y.domain([0, d3.max(data, function(d) { return d.y; })]);

            var bar = d3.select(thisCell).selectAll(".bar")
                .data(data)
                .enter().append("g")
                .attr("class", "bar")
                .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

            bar.append("rect")
                .attr("x", 1)
                .attr("width", x(data[0].dx) - 1)
                .attr("height", function(d) { return (size - padding/2) - y(d.y); })
                .style("fill", function () {
                    return color(parsedData[0].generation);
                });

        }


        function plot(p, thisCell) {

            var cell = d3.select(thisCell);

            x.domain(getDomain(p.x));
            y.domain(getDomain(p.y));

            cell.append("rect")
                .attr("class", "frame")
                .attr("x", padding / 2)
                .attr("y", padding / 2)
                .attr("width", size - padding)
                .attr("height", size - padding);

            cell.selectAll("circle")
                .data(parsedData)
                .enter().append("circle")
                .attr("cx", function (d) {
                    return x(d[p.x.column]);
                })
                .attr("cy", function (d) {
                    return y(d[p.y.column]);
                })
                .attr("r", 4)
                .style("fill", function (d) {
                    return color(d.generation);
                });
        }

        var brushCell;

        // Clear the previously-active brush, if any.
        function brushstart(p) {
            if (brushCell !== this) {
                d3.select(brushCell).call(brush.clear());
                x.domain(getDomain(p.x));
                y.domain(getDomain(p.y));
                brushCell = this;
            }
        }

        // Highlight the selected circles.
        function brushmove(p) {
            var e = brush.extent();
            svg.selectAll("circle").classed("not-selected", function (d) {
                return e[0][0] > d[p.x.column] || d[p.x.column] > e[1][0]
                    || e[0][1] > d[p.y.column] || d[p.y.column] > e[1][1];
            });
            highlightTimeSeries();
        }

        // If the brush is empty, select all circles.
        function brushend() {
            if (brush.empty()) svg.selectAll(".not-selected").classed("not-selected", false);
            highlightTimeSeries();
        }

        d3.select(self.frameElement).style("height", size * n + padding + 20 + "px");
    });

    function cross(a, b) {
        var c = [], n = a.length, m = b.length, i, j;
        for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j});
        return c;
    }

}