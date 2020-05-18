var express = require('express')
var app = express()
var sqlite3 = require('sqlite3').verbose()
const timestamp = require('time-stamp');
var fs = require('fs');
var formidable = require('formidable');

var exec = require('child_process').exec; //we use this EXEC to shut down
//we use this child to run our ALPR process
const cp = require('child_process');
const alpr = cp.fork('alpr.js');

//Once the child ALPR process is completed, take another picture and restart process
alpr.on('message', (m) => {
	//console.log('PARENT got message:', m);
	if (bCaptureOn) {
		shoot();
	}
  });

//If the end user turns on GPS, the browser will call this function to associate GPS coordinates with a photo
app.post('/plates/:id/addgps', function (req, res){
	var form = new formidable.IncomingForm();
	//console.log("got gps for "+req.params.id)
    form.parse(req, function (err, fields, files) {
		query = "update plates set "+
		"latitude = "+fields.latitude+ 
		",longitude="+fields.longitude+ 
		",accuracy="+fields.accuracy+ 
		",speed="+fields.speed+ 
		",heading="+fields.heading+ 
		",gtimestamp="+fields.gtimestamp+
		" where id="+req.params.id+";";
		//console.log(query);
		db.run(query, function(err) {
			if (err) {
				console.log("is error here")
			return console.log(err.message);
			}
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

//take a photo, then call the ALPR process to review, and call the browser to get GPS coordinates
const shoot = async () => {

	var filename = './images/img'+timestamp('YYYYMMDDHHmmss')+'.jpg';
	startTime = new Date();
	
	if (bStreamMode) {
		await streamCamera.takeImage().then(image => {
			stopTime = new Date();
			//console.log(filename);
			fs.writeFileSync(filename, image);
			query = "insert into plates ( filename,streammode,sensormode) values ('"+filename+"','1','"+iStreamSensorMode+"');";
			//console.log(query);
			db.run(query, function(err) {
				if (err) {
					console.log("is error here")
				return console.log(err.message);
				}
				alpr.send({ id: this.lastID });
				if (bGPSOn) {io.emit('getgps', {id: this.lastID});}
			});
		});
	}
	else {
		await stillCamera.takeImage().then(image => {
			stopTime = new Date();
			//console.log(filename);
			fs.writeFileSync(filename, image);
			query = "insert into plates ( filename,streammode,sensormode) values ('"+filename+"','0','0');";
			//console.log(query);
			db.run(query, function(err) {
				if (err) {
					console.log("is error here")
				return console.log(err.message);
				}
				alpr.send({ id: this.lastID });
				if (bGPSOn) {io.emit('getgps', {id: this.lastID});}
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


var http = require('http').createServer(app);
var io = require('socket.io')(http);

io.on('connection', (socket) => {
  //console.log('a user connected');
});

http.listen(3000, () => {
  console.log('Bicycle Dashcam - listening on *:3000');
});
var http = require('http').createServer(app);

app.use('/images', express.static(__dirname + '/images'));
app.use('/socket.io/', express.static(__dirname + '/socket.io/'));

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
	//console.log(strQuery);

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

