var express = require('express')
var app = express()
var sqlite3 = require('sqlite3').verbose()
const timestamp = require('time-stamp');
var fs = require('fs');

var exec = require('child_process').exec; //we use this EXEC to shut down
//we use this child to run our ALPR process
const cp = require('child_process');
const alpr = cp.fork('alpr.js');

alpr.on('message', (m) => {
	console.log('PARENT got message:', m);
	if (bCaptureOn) {
		shoot();
	}
  });

//use websockets to poll GPS, push stuff to client
var WebSocketServer = require('ws').Server;

wss = new WebSocketServer({port: 8080})
CLIENTS=[];

wss.on('connection', function(ws) {
	CLIENTS.push(ws);
	console.log("connected");
});

function wsSendAll (message) {
    for (var i=0; i<CLIENTS.length; i++) {
        CLIENTS[i].send(message);
    }
}

app.post('/plates/:id/addgps', function (req, res){
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
		author = fields.author;
		title = fields.title;
		pool.getConnection(function(err, connection) {
			strQuery = "INSERT INTO readinglog.readinglog (`userid`, `author`, `title`, `date`) VALUES ("+req.params.id+", '"+author+"', '"+title+"',concat(year(now()),'-',month(now()),'-',day(now()) ) );";
			console.log(strQuery);
			connection.query( strQuery, function(err, rows) {
				connection.release();
				});
			});
		res.sendStatus(200);
	    });

});

const { StillCamera, StreamCamera, Codec, SensorMode } = require('pi-camera-connect');

//node: modified still camera code to force sports exposure
const stillCamera = new StillCamera();

//5	1640x922	16:9	1/10 <= fps <= 40	x	 	Full	2x2
//6	1280x720	16:9	40 < fps <= 90	x	 	Partial	2x2
//7	640x480	4:3	40 < fps <= 90	x	 	Partial	2x2
const streamCamera1 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 30,
	sensorMode: SensorMode.Mode1
	});
const streamCamera2 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 15,
	sensorMode: SensorMode.Mode2
	});
const streamCamera530 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 30,
	sensorMode: SensorMode.Mode5
	});
const streamCamera540 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 40,
	sensorMode: SensorMode.Mode5
	});
const streamCamera641 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 41,
	sensorMode: SensorMode.Mode6
	});
const streamCamera660 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 60,
	sensorMode: SensorMode.Mode6
	});

var streamCamera = streamCamera530;

const shoot = async () => {

	var filename = './images/img'+timestamp('YYYYMMDDHHmmss')+'.jpg';
	startTime = new Date();
	
	if (bStreamMode) {
		await streamCamera.takeImage().then(image => {
			stopTime = new Date();
			console.log(filename);
			fs.writeFileSync(filename, image);
			query = "insert into plates ( filename,streammode,sensormode) values ('"+filename+"','1','5');";
			console.log(query);
			db.run(query, function(err) {
				if (err) {
					console.log("is error here")
				return console.log(err.message);
				}
				// get the last insert id
				console.log(`A row has been inserted with rowid ${this.lastID}`);
				alpr.send({ id: this.lastID });
				wsSendAll(this.lastID);
			});
		});
	}
	else {
		await stillCamera.takeImage().then(image => {
			stopTime = new Date();
			console.log(filename);
			fs.writeFileSync(filename, image);
			query = "insert into plates ( filename,streammode,sensormode) values ('"+filename+"','0','0');";
			console.log(query);
			db.run(query, function(err) {
				if (err) {
					console.log("is error here")
				return console.log(err.message);
				}
				// get the last insert id
				console.log(`A row has been inserted with rowid ${this.lastID}`);
				alpr.send({ id: this.lastID });
				wsSendAll(this.lastID);
			});
		});

	}
}

//globals
var bCaptureOn=false;
var bStreamMode=true;
var bGPSOn=false;
var iStreamSensorMode = 0;
var db = new sqlite3.Database('plates.db');

var server = app.listen(3000, function () {

    var host = server.address().address
    var port = server.address().port
  
    console.log('Plate info http://%s:%s', host, port)
  
  })

app.use('/images', express.static(__dirname + '/images'));

app.get('/togglestreammode', function(req, res){
	if (!bCaptureOn) {
		if (bStreamMode) {
			bStreamMode=false;
		}
		else {
			bStreamMode=true;
		}
	}
	res.redirect('/');
});

function setMode() {
	if (iStreamSensorMode==0) {streamCamera = streamCamera1;}
	if (iStreamSensorMode==1) {streamCamera = streamCamera2;}
	if (iStreamSensorMode==2) {streamCamera = streamCamera530;}
	if (iStreamSensorMode==3) {streamCamera = streamCamera540;}
	if (iStreamSensorMode==4) {streamCamera = streamCamera641;}
	if (iStreamSensorMode==5) {streamCamera = streamCamera660;}
}

app.get('/setsensormode', function(req, res){
	if (!bCaptureOn) {
		if (typeof req.query.mode !== 'undefined') {
			var iMode = parseInt(req.query.mode);
			if (Number.isInteger(iMode)) {
				if (iMode>5) {iStreamSensorMode=0;}
				else if (iMode<0) {iStreamSensorMode=0;}
				else {iStreamSensorMode=iMode;}
				setMode(); 
				}
		}
	}
	res.redirect('/');
});

app.get('/togglegps', function(req, res){

	if (bGPSOn) {
		bGPSOn=false;
	}
	else {
		bGPSOn=true;
	}
	res.redirect('/');
});

app.get('/togglecapture', function(req, res){
	if (bCaptureOn) {
		bCaptureOn=false;
		if (bStreamMode) {
			streamCamera.stopCapture();
		}
	}
	else {
		bCaptureOn=true;
		if (bStreamMode) {
			streamCamera.startCapture();
		}
		setTimeout(shoot, 3000)
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
			bStreamMode: bStreamMode,
			bCaptureOn: bCaptureOn,
			bGPSOn: bGPSOn,
			iStreamSensorMode: iStreamSensorMode,
			plates: rows,
			topid: topid,
			bottomid: bottomid,
			includenomatch: includenomatch
		});
	});


	});	

