/* 575 boilerplate main.js *///begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
	var queue = d3_queue.queue();
	//map frame dimensions
    var width = 960,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geo.albers()
        .center([0, 46.2])
        .rotate([-2, 0, 0])
        .parallels([43, 62])
        .scale(2500)
        .translate([width / 2, height / 2]);

    var path = d3.geo.path()
        .projection(projection);

    //use queue.js to parallelize asynchronous data loading
    queue
        .defer(d3.csv, "data/Healthdatacsv.csv") //load attributes from csv
        .defer(d3.json, "data/States.topojson") //load background spatial data
        .defer(d3.json, "data/Wisco_county.topojson") //load background spatial data
        .await(callback);



    function callback(error, csvData, states, wisco){
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

	    //translate europe TopoJSON
	    var allStates = topojson.feature(states, states.objects.States),
	        Wisconsin = topojson.feature(wisco, wisco.objects.Wisco_county).features;

	    //add Europe countries to map
        var statesUS = map.append("path")
            .datum(allStates)
            .attr("class", "statesUS")
            .attr("d", path);

        //add France regions to map
        var countyWI = map.selectAll(".countyWI")
            .data(Wisconsin)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "countyWI " + d.properties.Name;
            })
            .attr("d", path);
	};
};