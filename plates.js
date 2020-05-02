var express = require('express')
var app = express()
var sqlite3 = require('sqlite3').verbose()
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

const { StillCamera, StreamCamera, Codec, SensorMode } = require('pi-camera-connect');

var imageid =0;

var bCaptureOn=false;

var db = new sqlite3.Database('plates.db');

var identifyprocess;

var server = app.listen(3000, function () {

    var host = server.address().address
    var port = server.address().port
  
    console.log('Plate info http://%s:%s', host, port)
  
  })

app.use('/images', express.static(__dirname + '/images'));

app.get('/togglecapture', function(req, res){
	if (bCaptureOn) {
		bCaptureOn=false;
		identifyprocess.kill('SIGINT')
	}
	else {
		bCaptureOn=true;
		//identifyprocess = spawn('node /home/pi/plates/onlyidentify.js', ['interval=5']);
		identifyprocess = spawn('node',['/home/pi/plates/onlyidentify.js','interval=5'], {stdio: 'ignore' });
	}
	res.redirect('/');
});

app.get('/poweroff', function(req, res){

	shutdown(function(output){
		console.log(output);
	});

	res.send("Shutting down");
});

function shutdown(callback){
    exec('sudo shutdown now', function(error, stdout, stderr){ callback(stdout); });
}

app.get('/', function(req, res){	

	var limit="";
	var betweenclause="";
	var confidenceclause="";
	var whereclause="";
	var includenomatch="";
	var bottomid=0;
	var topid=0; 

	limit = "limit 20;";
	if (typeof req.query.bottomid !== 'undefined') {
		if (Number.isInteger(parseInt(req.query.bottomid))) {
			limit = "" //limit 10," + parseInt(req.query.bottomid) + ";"
			bottomid = parseInt(req.query.bottomid);
			}
	}

	if (typeof req.query.topid !== 'undefined') {
		if (Number.isInteger(parseInt(req.query.topid))) {
			limit = "" //limit 10," + parseInt(req.query.bottomid) + ";"
			topid = parseInt(req.query.topid);
			if (topid<1) {topid =1;}
			betweenclause = " id between " + bottomid + " and " + topid + " ";
			}
	}


	confidenceclause = " confidence > 0 "
	if (typeof req.query.includenomatch !== 'undefined') {
		includenomatch = req.query.includenomatch;
		if (req.query.includenomatch == 'only') {
			confidenceclause = " confidence = 0 "
			}
		if (req.query.includenomatch == 'true') {
			confidenceclause = " confidence >= 0 "
			}
		}

	whereclause = " where " + confidenceclause + " ";
	if (betweenclause.length > 0) {
		whereclause = whereclause +" and " + betweenclause;
	}

	
	strQuery= "select * from plates " + whereclause + "order by id desc " + limit;
	console.log(strQuery);

	db.all(strQuery, function(err,rows) {
		res.render('plates.ejs', {
			bCaptureOn: bCaptureOn,
			plates: rows,
			topid: topid,
			bottomid: bottomid,
			includenomatch: includenomatch
		});
	});


	});	

