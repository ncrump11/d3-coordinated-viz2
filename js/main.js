//.wrap everything in a self-executing anonymous function to move to local scope
(function(){

    //variables for data join
    var attrArray = ["Percent Adult Diabetes 2010", "Percent Obese Adults 2010", "Recreational Facilities per 1000 People", "Poverty Rate 2010", "Median Household Income 2010", "Farmer's Market per 1000 people"];
    var expressed = attrArray[0]
    

    ///begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){
    	
    	//map frame dimensions
        var width = window.innerWidth * 0.4,
            height = window.innerHeight * 1.2;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on France
        var projection = d3.geo.albers()
            .center([6, 44.5])
            .rotate([93, 0, -3])
            .parallels([40, 55])
            .scale(5000)
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
                Wisconsin = topojson.feature(wisco, wisco.objects.wisco_county).features; //convert MN/WI countiies to geojson feature
    	    console.log(Wisconsin)
            // add Europe countries to map
            var statesUS = map.append("path")
                .datum(allStates)
                .attr("class", "statesUS")
                .attr("d", path);


            //join csv data to GeoJSON enumeration units
            Wisconsin = joinData(Wisconsin, csvData);

             //create the color scale
            var colorScale = makeColorScale(csvData);
                //loop through csv to assign each set of csv attribute values to geojson region
            setEnumerationUnits(Wisconsin, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            createDropdown();
           
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

                var csvCounty = csvData[i]; //the current region
                var csvKey = csvCounty.NAME; //the CSV primary key

                //loop through geojson regions to find correct region
                for (var a=0; a<Wisconsin.length; a++){

                    var props = Wisconsin[a].properties; //the current region geojson properties
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
        console.log('hi')
        //add Counties to map
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
            });
    }

    function makeColorScale(data){
        var colorClasses = [
            "#feedde",
            "#fdbe85",
            "#fd8d3c",
            "#e6550d",
            "#a63603"
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
            return "#CCC";

        };
    };


    //function to create coordinated bar chart
    function setChart(csvData, colorScale){

        //chart frame dimensions
        var chartWidth = window.innerWidth * .6,
            chartHeight = window.innerHeight * 0.3,
            leftPadding = 100,
            rightPadding = 5,
            topBottomPadding = 10,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
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

        //create a scale to size bars proportionally to frame
        var yScale = d3.scale.linear()
            .range([0, chartInnerHeight])
            .domain([0, 20]);

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
            .attr("x", function(d, i){
                return i * (chartWidth / csvData.length);
            })
            .attr("height", function(d){
                return yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d){
                return chartInnerHeight - yScale(parseFloat(d[expressed]));
            })
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });

            //annotate bars with attribute value text
        var numbers = chart.selectAll(".numbers")
            .data(csvData)
            .enter()
            .append("text")
            .sort(function(a, b){
                return a[expressed]-b[expressed]
            })
            .attr("class", function(d){
                return "numbers " + d.NAME;
            })
            .attr("text-anchor", "middle")
            .attr("x", function(d, i){
                var fraction = chartWidth / csvData.length;
                return i * fraction + (fraction - 1) / 2;
            })
            .attr("y", function(d){
                return chartHeight - yScale(parseFloat(d[expressed])) + 15;
            })
            .text(function(d){
                return d[expressed];
            });

        var chartTitle = chart.append("text")
        .attr("x", 200)
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
    };
        //function to create a dropdown menu for attribute selection
    function createDropdown(){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown");

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

})();