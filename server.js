/*
Author: Brandon Gannicott
Date: 10/16/14
*/

// Requires

var restify = require('restify');
var mysql = require('mysql');
var url = require('url');
var sprintf = require("sprintf-js").sprintf,
    vsprintf = require("sprintf-js").vsprintf

// Server config

var pool = mysql.createPool({
	connectionLimit : 10,
	host : 'ec2-54-183-137-241.us-west-1.compute.amazonaws.com',	
	user : 'root',
	password : 'dbpassword',
	database : 'aq'
});

var server = restify.createServer({name: 'sink'});

server
	.use(restify.fullResponse())
	.use(restify.bodyParser())

//
// HTTP Handlers
//

server.get('/test', function(req, res, next){
	pool.query('SELECT text FROM test', function(err, rows, fields){
		if (err) throw err;
		
		res.send(rows);

		return next();
	});
});

server.get('/all', function(req, res, next){
	pool.query('SELECT * FROM readings', function(err, rows, fields){
		if (err) throw err;
	
		res.send(rows);

		return next();
	});
});

/*
endpoint:port/q?timeStart=0-0-00Z00:00&timeEnd=0-0-00Z00:00
endpoint:port/q?bottomLeft=000.000000Z000.000000&topLeft=000.000000Z000.000000
endpoint:port/q?bottomLeft=000.000000Z000.000000&topLeft=000.000000Z000.000000&timeStart=0-0-00Z00:00&timeEnd=0-0-00Z00:00
*/
server.get('/q', function(req, res, next){
	var stmt = "SELECT * FROM readings WHERE ";
	var conditions = [];
	// Get params
	var query = url.parse(req.url, true).query;
	
	// Add time interval condition if present in params
	if(query.hasOwnProperty('timeStart') && query.hasOwnProperty('timeEnd')){
		conditions.push(sprintf("(ts BETWEEN %s AND %s)", query.timeStart, query.timeEnd));
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
	pool.query(stmt, function(err, rows, fields){
		if(err) throw err;

		res.send(rows);

		return next();
	});

})

/*
	convenience queries:
	all readings for month m
	all readings for week w
	all readings for day d
	all readings for hour h
	all readings since DATETIME dt
	all 
*/

/* 
  Upload filtering? How to aggregate incoming readings? 
  Can we assume that duplicates can only exist if the time and location are very close?
  If that's the case, then we just want to filter uploads that occur around the same time threshold
 
  Put them all into a queue and then evaluate as a batch?
*/
server.post('/upload', function(req, res, next){
	var body = JSON.parse(req.body)
	//body has the properties of the reading
	pool.query('INSERT INTO readings SET ?', body, function(err, result){
		if (err) throw err;

		res.send(result);

		return next();
	});	
});

// Utility functions

var coords = function(array){
	return {lon: array[0], lat: array[1]}
}

// Listen for requests

server.listen(8000, function(){
	console.log('%s listening at %s', server.name, server.url);	
})