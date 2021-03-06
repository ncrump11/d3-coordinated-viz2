//.wrap everything in a self-executing anonymous function to move to local scope
(function(){

    //variables for data join
    var attrArray = ["Percent Adult Diabetes", "Percent Obese Adults", "Recreational Facilities per 1000 people", "Poverty Rate", "Median Household Income", "Farmer's Market per 100 people"];
    var expressed = attrArray[0]
    
    //chart frame dimension
    var chartWidth = window.innerWidth * .5,
        chartHeight = window.innerHeight * .5,
        leftPadding = 50,
        rightPadding = 5,
        topBottomPadding = 10,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    ///begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){
    	
    	//map frame dimensions
        var width = window.innerWidth * 0.4,
            height = window.innerHeight * 1;

        //create new svg container for the map
        var map = d3.select("#map")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on Wisconsin
        var projection = d3.geo.albers()
            .center([6, 44.5])
            .rotate([93, 0, -3])
            .parallels([40, 55])
            .scale(8000)
            .translate([width / 2, height / 2]);

        var path = d3.geo.path()
            .projection(projection);

        //use queue.js to parallelize asynchronous data loading
        var queue = d3_queue.queue();
        d3_queue.queue()
            .defer(d3.csv, "data/HealthData2.csv") //load attributes from csv
            .defer(d3.json, "data/states.topojson") //load background spatial data
            .defer(d3.json, "data/wisco_county.topojson") //load background spatial data
            .await(callback);



        function callback(error, csvData, states, wisco){

            //place graticule on the map
            setGraticule(map, path);

    	    //translate TopoJSON
    	    var allStates = topojson.feature(states, states.objects.states); //convert background to geojson feature
                Wisconsin = topojson.feature(wisco, wisco.objects.wisco_county).features; //convert WI counties to geojson feature
            // add US States to map
            var statesUS = map.append("path")
                .datum(allStates)
                .attr("class", "statesUS")
                .attr("d", path);


            //join csv data to GeoJSON enumeration units
            Wisconsin = joinData(Wisconsin, csvData);
            
             //create the color scale
            var colorScale = makeColorScale(csvData);
                //loop through csv to assign each set of csv attribute values to geojson county
            setEnumerationUnits(Wisconsin, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            createDropdown(csvData);


           
        };
    };

    function setGraticule(map, path) {


        var graticule = d3.geo.graticule()
                .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude
            
            //create graticule background
            var gratBackground = map.append("path")
                .datum(graticule.outline()) //bind graticule background
                .attr("class", "gratBackground") //assign class for styling
                .attr("d", path) //project graticule

             var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
                .data(graticule.lines()) //bind graticule lines to each element to be created
                .enter() //create an element for each datum
                .append("path") //append each element to the svg as a path element
                .attr("class", "gratLines") //assign class for styling
                .attr("d", path); //project graticule lines
    }

    function joinData(Wisconsin, csvData) {

        for (var i=0; i<csvData.length; i++){

                var csvCounty = csvData[i]; //the current county
                var csvKey = csvCounty.NAME; //the CSV primary key

                //loop through geojson counties to find correct one
                for (var a=0; a<Wisconsin.length; a++){

                    var props = Wisconsin[a].properties; //the current county geojson properties
                    var key = props.NAME; //the geojson primary key

                    //where primary keys match, transfer csv data to geojson properties object
                    if (key == csvKey){

                        //assign all attributes and values
                        attrArray.forEach(function(attr){
                            var val = parseFloat(csvCounty[attr]); //get csv attribute value
                            props[attr] = val; //assign attribute and value to geojson properties
                            
                        });
                    };
                };
            };
        return Wisconsin;
    }

    //add enumeration units to the map
    function setEnumerationUnits(Wisconsin, map, path, colorScale){
        //add counties to map
        var countyWI = map.selectAll(".countyWI")
            .data(Wisconsin)
            .enter()
            .append("path")
            .attr("class", function(d){
                
                return "countyWI " + d.properties.NAME;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            })
            .on("mouseover", function(d){
                highlight(d.properties);
            })
            .on("mouseout", function(d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);

        //add style descriptor to each path
        var desc = countyWI.append("desc")
            .text('{"stroke": "#FFFFFF", "stroke-width": "0"}');
    }

    function makeColorScale(data){
        var colorClasses = [
            "#f2f0f7",
            "#cbc9e2",
            "#9e9ac8",
            "#756bb1",
            "#54278f"
        ];

        //create color scale generator
        var colorScale = d3.scale.threshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;
    };
    //function to test for data value and return color
    function choropleth(props, colorScale){

        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (val && val != NaN){
            return colorScale(val);
        } else {
            return "#999";

        };
    };


    //function to create coordinated bar chart
    function setChart(csvData, colorScale){

        //create a second svg element to hold the bar chart
        var chart = d3.select("#chart")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        var yScale = d3.scale.linear()
              //dynamic change for y scale using max for each variable
              .domain([0, d3.max(csvData,function(d){ return parseFloat(d[expressed])})*1.1])
              //output this between 0 and chartInnerHeight
              .range([0, chartInnerHeight]);

        //set bars for each county
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return a[expressed]-b[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.NAME;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);

        //add style descriptor to each bar
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0"}');

        //annotate bars with attribute value text

        var chartTitle = chart.append("text")
        .attr("x", 100)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text(expressed + " in each county");

        //create vertical axis generator
        var yAxis = d3.svg.axis()
            .scale(yScale)
            .orient("left");

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bar position, heights, and colors
        updateChart(bars, csvData.length, colorScale, csvData);
    };
        //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)
            });
        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };
    //dropdown change listener handler
    function changeAttribute(attribute, csvData){
        //change the expressed attribute
        expressed = attribute;
        var yScale = d3.scale.linear()
              //dynamic change for y scale using max for each variable
              .domain([0, d3.max(csvData,function(d){ return parseFloat(d[expressed])})*1.1])
              //output this between 0 and chartInnerHeight
              .range([0, chartInnerHeight]);

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var countyWI = d3.selectAll(".countyWI")
            .transition()
            .duration(1000)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });
        //set bars for each county
        var bars = d3.selectAll(".bar")
            //resort bars
            .sort(function(a, b){
                return a[expressed]-b[expressed]
            })
            .transition() //add animation
            .delay(function(d, i){
                return i * 20
            })
            .duration(500);

        updateChart(bars, csvData.length, colorScale, csvData)
    };
    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale, csvData){

        //position bars
        bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
            //size and resize bars
            .attr("height", function(d, i){
                var yScale = d3.scale.linear()
                      //dynamic change for y scale using max value for each variable
                      .domain([0, d3.max(csvData,function(d){ return parseFloat(d[expressed])})* 1.2])
                      //output this between 0 and chartInnerHeight
                      .range([0, chartInnerHeight]);
                return yScale(parseFloat(d[expressed])) + 10;
            })
            .attr("y", function(d,i){
                var yScale = d3.scale.linear()
                      //dynamic change for y scale using max for each variable
                      .domain([0, d3.max(csvData,function(d){ return parseFloat(d[expressed])})* 1.2])
                      //output this between 0 and chartInnerHeight
                      .range([0, chartInnerHeight]);
                return chartInnerHeight - yScale(parseFloat(d[expressed]));
            })
            //color/recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });

        var chartTitle = d3.select(".chartTitle")
        .text(expressed + " in Each County");
        
    };
    //function to highlight enumeration units and bars
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.NAME)
            .style({
                "stroke": "#81FC81",
                "stroke-width": "2px"
            })
        setLabel(props);
    };
    //function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("." + props.NAME)
            
            .style({
                "stroke": function(){
                    return getStyle(this, "stroke")
                },
                "stroke-width": function(){
                    return getStyle(this, "stroke-width")
                }

            });

        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };
    d3.select(".infolabel")
        .remove();   
    };
    //function to create dynamic label
    function setLabel(props){
        
        //label content
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed + "</b>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr({
                "class": "infolabel",
                "id": props.NAME + "_label"
            })
            .html(labelAttribute);

        var countyName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.NAME + " County");
    };
    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1; 

        d3.select(".infolabel")
            .style({
                "left": x + "px",
                "top": y + "px"
            });
    }; 
})();