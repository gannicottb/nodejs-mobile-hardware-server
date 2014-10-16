/*
Author: Brandon Gannicott
Date: 10/16/14
*/

var restify = require('restify');
var mysql = require('mysql');

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

server.post('/upload', function(req, res, next){
	var body = JSON.parse(req.body)
	//body has the properties of the reading
	pool.query('INSERT INTO readings SET ?', body, function(err, result){
		if (err) throw err;

		res.send(result);

		return next();
	});	
});

// Listen for requests

server.listen(8000, function(){
	console.log('%s listening at %s', server.name, server.url);	
})