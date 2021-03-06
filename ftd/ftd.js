var port = 8000; 
var express = require('express');
var app = express();

const { Pool } = require('pg')
const pool = new Pool({
    user: 'webdbuser',
    host: 'localhost',
    database: 'webdb',
    password: 'password',
    port: 5432
});

const bodyParser = require('body-parser'); // we used this middleware to parse POST bodies

function isObject(o){ return typeof o === 'object' && o !== null; }
function isNaturalNumber(value) { return /^\d+$/.test(value); }

// app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// app.use(bodyParser.raw()); // support raw bodies

// Non authenticated route. Can visit this without credentials
app.post('/api/test', function (req, res) {
	res.status(200); 
	res.json({"message":"got here"}); 
});

// Another non-authenticated route, since again, we have no user to authenticate yet
app.post('/api/registration', function (req, res) {

	var difficulty = "easy";

	if (!("username" in req.body) || !("password" in req.body) || !("difficulty" in req.body)) {
		res.status(401).json({"error":"expected a username & password... and difficulty."});
		return;
	}

	// Extra validation
	difficulty = req.body.difficulty;
	if (!(difficulty== 'easy' || difficulty== 'medi' || difficulty== 'hard')) { 
		difficulty = "easy"; 
		console.log("DEFAULT TO EASY."); 
	}

	let sql = 'INSERT INTO ftduser VALUES($1, sha512($2), $3)';
	pool.query(sql, [req.body.username, req.body.password, difficulty], (err, pgRes) => {
		if (err) { res.status(403).json({ error: 'User already exists in database!'}); } 
		else { res.status(200).json({ message: 'registration succesful'}); }
	});

	let sql2 = 'INSERT INTO ftdwins VALUES($1, 0, 0)';
	// should always work, since we know user was just created
	pool.query(sql2, [req.body.username], (err, pgRes) => {});
});

app.get('/api/leaderboards', function (req, res) {
	let sql = 'SELECT * FROM ftdwins ORDER BY score DESC';
	pool.query(sql, [], (err, pgRes) => {
		if (err) { res.status(403).json({ error: 'Could not get leaderboards'}); } 
		else { res.status(200).json({ message: pgRes.rows}); }
	});
});

/** 
 * This is middleware to restrict access to subroutes of /api/auth/ 
 * To get past this middleware, all requests should be sent with appropriate
 * credentials. Now this is not secure, but this is a first step.
 *
 * Authorization: Basic YXJub2xkOnNwaWRlcm1hbg==
**/
app.use('/api/auth', function (req, res,next) {
	if (!req.headers.authorization) {
		return res.status(403).json({ error: 'No credentials sent!' });
  	}
	try {
		// var credentialsString = Buffer.from(req.headers.authorization.split(" ")[1], 'base64').toString();
		var m = /^Basic\s+(.*)$/.exec(req.headers.authorization);

		var user_pass = Buffer.from(m[1], 'base64').toString()
		m = /^(.*):(.*)$/.exec(user_pass); // probably should do better than this

		var username = m[1];
		var password = m[2];

		console.log(username+" "+password);

		let sql = 'SELECT * FROM ftduser WHERE username=$1 and password=sha512($2)';
        	pool.query(sql, [username, password], (err, pgRes) => {
  			if (err){
                		res.status(403).json({ error: 'Not authorized'});
			} else if(pgRes.rowCount == 1){
				next(); 
			} else {
                		res.status(403).json({ error: 'Not authorized'});
        		}
		});
	} catch(err) {
               	res.status(403).json({ error: 'Not authorized'});
	}
});

// All routes below /api/auth require credentials 
app.post('/api/auth/login', function (req, res) {
	res.status(200); 
	res.json({"message":"authentication success"}); 
});

app.get('/api/auth/getGameDifficulty', function (req, res) {

	var m = /^Basic\s+(.*)$/.exec(req.headers.authorization);
	var user_pass = Buffer.from(m[1], 'base64').toString();
	m = /^(.*):(.*)$/.exec(user_pass);
	// no need for try catch here, since auth already checks that this user exists.
	var username = m[1]; 

	let sql = 'SELECT difficulty FROM ftduser WHERE username=$1';
		pool.query(sql, [username], (err, pgRes) => {
			if (err) { res.status(403).json({"error": 'NOT FOUND!'}); } 
			else { res.status(200).json({"message": pgRes.rows[0].difficulty}); }
		});
});

app.delete('/api/auth/deleteUser', function (req, res) {
	var m = /^Basic\s+(.*)$/.exec(req.headers.authorization);
	var user_pass = Buffer.from(m[1], 'base64').toString();
	m = /^(.*):(.*)$/.exec(user_pass);
	// no need for try catch here, since auth already checks that this user exists.
	var username = m[1]; 

	let sql = "DELETE FROM ftduser WHERE username=$1";
		pool.query(sql, [username], (err, pgRes) => {
			if (err) { res.status(403).json({err}); } 
			else { res.status(200).json({"message": "delete succesful."}); }
		});
});

app.put('/api/auth/updateUser', function (req, res) {

	if (!("newpass" in req.body && "newdiff" in req.body)) {
		res.status(401).json({"error":"expected a new password and difficulty"});
		return;
	}

	var m = /^Basic\s+(.*)$/.exec(req.headers.authorization);
	var user_pass = Buffer.from(m[1], 'base64').toString();
	m = /^(.*):(.*)$/.exec(user_pass);
	// no need for try catch here, since auth already checks that this user exists.
	var username = m[1]; 

	let sql = "UPDATE ftduser SET difficulty=$1, password=sha512($2) WHERE username=$3";
		pool.query(sql, [req.body.newdiff, req.body.newpass, username], (err, pgRes) => {
			if (err) { res.status(403).json({err}); } 
			else { res.status(200).json({"message": "update user succesful."}); }
		});
});

app.post('/api/auth/updateWins', function (req, res) {
	if (!("scoreToAdd" in req.body)) {
		res.status(401).json({"error":"expected a score to add."});
		return;
	}

	var m = /^Basic\s+(.*)$/.exec(req.headers.authorization);
	var user_pass = Buffer.from(m[1], 'base64').toString();
	m = /^(.*):(.*)$/.exec(user_pass);
	// no need for try catch here, since auth already checks that this user exists.
	var username = m[1]; 

	let sql = "UPDATE ftdwins SET score = score + $1, wins = wins + 1 WHERE username=$2";
		pool.query(sql, [req.body.scoreToAdd, username], (err, pgRes) => {
			if (err) { res.status(403).json({err}); } 
			else { res.status(200).json({"message": "score and wins updated."}); }
		});
});

app.post('/api/auth/test', function (req, res) {
	res.status(200); 
	res.json({"message":"got to /api/auth/test"}); 
});

app.use('/',express.static('static_content')); 

app.listen(port, function () {
  	console.log('Example app listening on port '+port);
});
