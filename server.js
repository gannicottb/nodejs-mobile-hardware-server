/*
Author: Brandon Gannicott
Date: 10/16/14
Version: 0.1.4
Changelog:
11/12: Found out that AQI calculation was bugged. Fixed the bug (convert to Number) and added rounding (as per EPA)
10/30: Added AQI calculation for PM2.5 readings (added to each reading object before calling valueArray())
10/22: Added /nuke/:table. Upload expects an array of readings. Will work for any number of readings in any state of completeness
*/

// Requires
//
var restify = require('restify');
var mysql = require('mysql');
var url = require('url');
var sprintf = require("sprintf-js").sprintf,
    vsprintf = require("sprintf-js").vsprintf

// Globals
//
var keys = ['ts','lat','lon','co','pm','hum','temp','elev','wind','precip', 'pm_aqi'];
var breakpoints = {
	0.0   : 0,
	15.4  : 50,
	40.4  : 51,
	40.5  : 101,
	65.4  : 150,
	65.5  : 151,
	150.4 : 200,
	150.5 : 201,
	250.4 : 300,
	250.5 : 301,
	350.4 : 400,
	350.5 : 401,
	500.4 : 500
}

var version = "0.1.4";

// Server config
//
var pool = mysql.createPool({
	connectionLimit : 10,
	host : 'ec2-54-183-137-241.us-west-1.compute.amazonaws.com',	
	user : 'root',
	password : 'dbpassword',
	database : 'aq',
	timezone : 'utc'
});

var server = restify.createServer({name: 'sink'});

server
	.use(restify.fullResponse())
	.use(restify.bodyParser())

//
// HTTP Handlers
//
server.get('/all', function(req, res, next){
	queryAndReturn("SELECT * FROM readings", res, next);
});

server.get('/id/:id', function(req, res, next){
	queryAndReturn("SELECT * from readings WHERE id ="+req.params.id, res, next);
});

//This is the killswitch to easily dump crap debugging data
server.get('/nuke/:table', function(req, res, next){
	var stmt = "DELETE FROM "+req.params.table;
	queryAndReturn(stmt, res, next);
});

/*
endpoint:port/q?timeStart=0-0-00Z00:00&timeEnd=0-0-00Z00:00
endpoint:port/q?bottomLeft=000.000000Z000.000000&topLeft=000.000000Z000.000000
endpoint:port/q?bottomLeft=000.000000Z000.000000&topLeft=000.000000Z000.000000&timeStart=0-0-00Z00:00&timeEnd=0-0-00Z00:00

example vv
endpoint:port/q?bottomLeft=69.000Z29.000&topRight=71.000Z31.000&timeStart=2014-10-15&timeEnd=2014-10-17
*/

server.get('/q', function(req, res, next){
	var stmt = "SELECT * FROM readings WHERE ";
	var conditions = [];
	// Get params
	var query = url.parse(req.url, true).query;
	
	// Add time interval condition if present in params
	if(query.hasOwnProperty('timeStart') && query.hasOwnProperty('timeEnd')){
		conditions.push(sprintf("(ts BETWEEN '%s' AND '%s')", query.timeStart, query.timeEnd));
		console.log(conditions);	
	}

	// Add location condition if present in params 
	if(query.hasOwnProperty('bottomLeft') && query.hasOwnProperty('topRight')){

		var bl = coords(query.bottomLeft.split('Z'));
		var tr = coords(query.topRight.split('Z'));

		conditions.push(sprintf("(lon BETWEEN %s AND %s) AND (lat BETWEEN %s AND %s)",
			bl.lon, tr.lon, bl.lat, tr.lat));

		console.log(conditions);
	}

	// Add conditions to statement
	stmt += conditions.join(" AND ");
	console.log(stmt);

	//Run the query for the prepared statement
	queryAndReturn(stmt, res, next);

})

/* 
  Upload filtering? How to aggregate incoming readings? 
  Can we assume that duplicates can only exist if the time and location are very close?
  If that's the case, then we just want to filter uploads that occur around the same time threshold
 
  Put them all into a queue and then evaluate as a batch?
*/
server.post('/upload', function(req, res, next){
	var body = JSON.parse(req.body);
	console.log(body);
	if(!body.hasOwnProperty('readings')){
		return next(new restify.InvalidArgumentError("The upload should contain an array of readings with the key readings"));
	}

	stmt = "INSERT INTO readings ("+keys.join(", ")+") VALUES ?";
	values = [];
	body.readings.map(function(reading){
		// calculate the AQI for the pm reading and add it to the reading object
		reading.pm_aqi = reading.hasOwnProperty('pm') ? aqi(reading.pm) : 0	
		values.push(valuesArray(reading));
	});

	console.log(values);
	
	pool.query(stmt, [values], function(err, result){
		if (err) return next(err);

		res.send(result);

		return next();
	});	
});

// Utility functions

var queryAndReturn = function(stmt, res, next){
	pool.query(stmt, function(err, rows, fields){
		if(err) 
			return next(err);
		res.send(rows);
		return next();
	});
};

var coords = function(array){
	return {lon: array[0], lat: array[1]}
};

var valuesArray = function(obj){
	var val = []
    keys.map(function(key){
        val.push(obj[key]);
    })
	return val;
};

/*
	Converts concentration into AQI as per EPA memoranda EPA-454/B-06-001, May 2006
*/
var aqi = function(c){
	//c = rounded concentration of pm2.5 in ug/m3
	c = Number(Number(c).toFixed(3));
	if(c == 0) return 0;

	var bp_hi, i_hi, bp_lo, i_lo;
    
    var bp = Object.keys(breakpoints);
	bp.some(function(key, index){
        if (key >= c){
			bp_hi = key;            
			i_hi = breakpoints[bp_hi];	
            bp_lo = bp[Math.max(0,index - 1)];
            i_lo = breakpoints[bp_lo];
            return true;
		}
	})  
    return Math.round(((i_hi - i_lo)/(bp_hi - bp_lo)) * (c - bp_lo) + i_lo);	
};

// Listen for requests

server.listen(8000, function(){
	console.log("Version:", version);
	console.log('%s listening at %s', server.name, server.url);	
})
