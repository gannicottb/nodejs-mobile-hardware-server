/*
Author: Brandon Gannicott
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

server.get('/test', function(req, res, next){
	pool.query('SELECT text FROM test', function(err, rows, fields){
		if (err) throw err;

		console.log(rows);
		res.send("No Error!")

		return next();
	})
})

server.post('/upload', function(req, res, next){
	var body = JSON.parse(req.body)
	console.log(body.title)

	return next();
})

server.listen(3000, function(){
	console.log('%s listening at %s', server.name, server.url);	
})