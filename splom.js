function paramTable( ){
  // base on http://www.d3noob.org/2013/02/add-html-table-to-your-d3js-graph.html
  var table = d3.select('#paramTable').append("table");
  table.classed('table', true).classed('table-bordered', true); // apply bootstrap table themeing

  var tHead = table.append("thead");
  var tBody = table.append("tbody");


  var columns = ['name', 'type', 'min', 'max'];
    tHead.append("tr")
    .selectAll("th")
    .data(columns)
    .enter()
    .append("th")
    .text(function(column) { return column; });


  // add rows
  var rows = tBody.selectAll("tr")
    .data(model.params)
    .enter()
    .append("tr");


  var cells = rows.selectAll("td")
      .data( function(row) {
        // callback must return data in format:
        // {name: "p5", type: "uniform", min: 0, max: 30}

        return columns.map(function(column) {
          return {column: column, value: row[column]};
        });

      })
      .enter()
      .append("td")
      .html(function(d) { return d.value; });

}

function selectEpsilon(d, i){
    console.log(i);

    d3.select('#epsilons').selectAll("button").classed("active", false);
    d3.select(this).classed("active", true);

    plotSPLOM( form_url_for_population(i+1) );

}

function selectEpsilonFromSelection(button, i){
  console.log("from URL" + i);

  d3.select('#epsilons').selectAll("button").classed("active", false);
  button.classed("active", true);

  plotSPLOM( form_url_for_population(i+1) );

}


function form_url_for_population(i) {
  // returns path for the i'th population [1-indexed]
  return path + "results_" + modelName + "/Population_" + (i) + "/data_Population" + (i) + ".txt"
}

function listEpsilons( ){
  d3.select('#epsilons').append("p")
    .selectAll("p") // create empty selection
    .data(global_data.epsilon_schedule)
    .enter().append("button")
    .text( function(d){ return d; } )
    .classed("btn", true)
    .classed("btn-default", true)
    .on("click", selectEpsilon );
}

function plotSPLOM( dataURL ){


  var width = 960,
      size = 230,
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

  var color = d3.scale.category10();

  d3.text(dataURL, function(error, rawData) {
    if (error) throw error;

    var dsv = d3.dsv(" ", "text/plain");
    parsedData = dsv.parseRows(rawData);

    var domainByParam = {},
      params = model.params.filter(function (x){ return x.type != "constant"; }),
      n = params.length;

      for (var i=0; i<n;i++){
        domainByParam[ params[i] ] = d3.extent( [model.params[i].min, model.params[i].max] )
      }

      //params.forEach(function(param) {
      //  domainByParam[param] = d3.extent(data, function(d) { return d[param]; });
      //});

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
        .attr("transform", function(d, i) { return "translate(" + (n - i - 1) * size + ",0)"; })
        .each(function(d) { x.domain(domainByParam[d]); d3.select(this).call(xAxis); });

    svg.selectAll(".y.axis")
        .data(params)
        .enter().append("g")
        .attr("class", "y axis")
        .attr("transform", function(d, i) { return "translate(0," + i * size + ")"; })
        .each(function(d) { y.domain(domainByParam[d]); d3.select(this).call(yAxis); });

    var cell = svg.selectAll(".cell")
        .data(cross(params, params))
        .enter().append("g")
        .attr("class", "cell")
        // Swapped column order by changing (n - d.i - 1) to (d.i)
        .attr("transform", function(d) { return "translate(" + (d.i) * size + "," + d.j * size + ")"; })
        .each(plot);

    // Titles for the diagonal.
    cell.filter(function(d) { return d.i === d.j; }).append("text")
        .attr("x", padding)
        .attr("y", padding)
        .attr("dy", ".71em")
        .text(function(d) { return d.x.name; });

    cell.call(brush);

    function plot(p) {


      var cell = d3.select(this);

      x.domain(domainByParam[p.x]);
      y.domain(domainByParam[p.y]);

      cell.append("rect")
          .attr("class", "frame")
          .attr("x", padding / 2)
          .attr("y", padding / 2)
          .attr("width", size - padding)
          .attr("height", size - padding);

      cell.selectAll("circle")
          .data(parsedData)
          .enter().append("circle")
          .attr("cx", function(d) { return x(d[p.x.column]); })
          .attr("cy", function(d) { return y(d[p.y.column]); })
          .attr("r", 4)
          .style("fill", function(d) { return color(1); } );
    }

    var brushCell;

    // Clear the previously-active brush, if any.
    function brushstart(p) {
      if (brushCell !== this) {
        d3.select(brushCell).call(brush.clear());
        x.domain(domainByParam[p.x]);
        y.domain(domainByParam[p.y]);
        brushCell = this;
      }
    }

    // Highlight the selected circles.
    function brushmove(p) {
      var e = brush.extent();
      svg.selectAll("circle").classed("not-selected", function(d) {
        return e[0][0] > d[p.x.column] || d[p.x.column] > e[1][0]
            || e[0][1] > d[p.y.column] || d[p.y.column] > e[1][1];
      });
    }

    // If the brush is empty, select all circles.
    function brushend() {
      if (brush.empty()) svg.selectAll(".not-selected").classed("not-selected", false);
    }

    d3.select(self.frameElement).style("height", size * n + padding + 20 + "px");
  });

  function cross(a, b) {
    var c = [], n = a.length, m = b.length, i, j;
    for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j});
    return c;
  }

}