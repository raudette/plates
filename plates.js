const timestamp = require('time-stamp');
var openalpr = require ("node-openalpr");
var express = require('express')
var app = express()
var sqlite3 = require('sqlite3').verbose()

const { StillCamera, StreamCamera, Codec, SensorMode } = require("pi-camera-connect");

var imageid =0;

//this will turn the capture on or off
var bCaptureOn=false;
//Stream or Still mode
var bStreamMode=false;
//Stream Sensor Mode
var iStreamSensorMode=0;

//get cameras started
const stillCamera = new StillCamera();
const streamCamera0 = new StreamCamera({
	codec: Codec.MJPEG,
	sensorMode: SensorMode.AutoSelect
	});
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
const streamCamera3 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 2,
	sensorMode: SensorMode.Mode3
	});
const streamCamera4 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 42,
	sensorMode: SensorMode.Mode4
	});
const streamCamera5 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 49,
	sensorMode: SensorMode.Mode5
	});
const streamCamera6 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 60,
	sensorMode: SensorMode.Mode6
	});
const streamCamera7 = new StreamCamera({
	codec: Codec.MJPEG,
	fps: 90,
	sensorMode: SensorMode.Mode7
	});
var streamCamera = streamCamera0;

var db = new sqlite3.Database('plates.db');

var server = app.listen(3000, function () {

    var host = server.address().address
    var port = server.address().port
  
    console.log('Plate info http://%s:%s', host, port)
  
  })

app.use('/images', express.static(__dirname + '/images'));

app.get('/togglecapture', function(req, res){
	if (bCaptureOn) {
		bCaptureOn=false;
	}
	else {
		bCaptureOn=true;
	}
	res.redirect('/');
});

app.get('/togglestreammode', function(req, res){
	if (bStreamMode) {
		bStreamMode=false;
		streamCamera.stopCapture();
	}
	else {
		bStreamMode=true;
		streamCamera.startCapture();
	}
	res.redirect('/');
});

function setMode() {
	if (bStreamMode) {	streamCamera.stopCapture();}
	if (iStreamSensorMode==0) {streamCamera = streamCamera0;}
	if (iStreamSensorMode==1) {streamCamera = streamCamera1;}
	if (iStreamSensorMode==2) {streamCamera = streamCamera2;}
	if (iStreamSensorMode==3) {streamCamera = streamCamera3;}
	if (iStreamSensorMode==4) {streamCamera = streamCamera4;}
	if (iStreamSensorMode==5) {streamCamera = streamCamera5;}
	if (iStreamSensorMode==6) {streamCamera = streamCamera6;}
	if (iStreamSensorMode==7) {streamCamera = streamCamera7;}
	if (bStreamMode) {	streamCamera.startCapture();}
}

app.get('/setsensormode', function(req, res){
	if (typeof req.query.mode !== 'undefined') {
		var iMode = parseInt(req.query.mode);
		if (Number.isInteger(iMode)) {
			if (iMode>7) {iStreamSensorMode=0;}
			else if (iMode<0) {iStreamSensorMode=0;}
			else {iStreamSensorMode=iMode;}
			setMode(); 
			}
	}
	res.redirect('/');
});

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

	var sStreamSensorMode="";
	if (iStreamSensorMode==0) {sStreamSensorMode = "Auto";}
	if (iStreamSensorMode==1) {sStreamSensorMode = "1: 1920x1080 30 fps";}
	if (iStreamSensorMode==2) {sStreamSensorMode = "2: 2592x1944 15 fps";}
	if (iStreamSensorMode==3) {sStreamSensorMode = "3: 2592x1944 2 fps";}
	if (iStreamSensorMode==4) {sStreamSensorMode = "4: 1296x972 42 fps";}
	if (iStreamSensorMode==5) {sStreamSensorMode = "5: 1296x730 49 fps";}
	if (iStreamSensorMode==6) {sStreamSensorMode = "6: 640x480 60 fps";}
	if (iStreamSensorMode==7) {sStreamSensorMode = "7: 640x480 90 fps";}


	db.all(strQuery, function(err,rows) {
		res.render('plates.ejs', {
			bCaptureOn: bCaptureOn,
			plates: rows,
			topid: topid,
			bottomid: bottomid,
			sStreamSensorMode: sStreamSensorMode,
			bStreamMode: bStreamMode,
			includenomatch: includenomatch
		});
	});


	});	

function ShootAndAssess () {

	if (bCaptureOn) {
		var filename = './images/img'+timestamp('YYYYMMDDHHmmss')+'.jpg';

		if (bStreamMode) {
			startTime = new Date();
			streamCamera.takeImage().then(image => {
				stopTime = new Date();
				console.log('stream image taken set:'+ (stopTime-startTime));
				fs.writeFileSync(filename, image);
				identify(imageid, filename);
				imageid = imageid +1;
			});
		}
		else {
			startTime = new Date();
			stillCamera.takeImage().then(image => {
				stopTime = new Date();
				console.log('still image taken set:'+ (stopTime-startTime));
				fs.writeFileSync(filename, image);
				identify(imageid, filename);
				imageid = imageid +1;
				});
		}
/* works
		const stillCamera = new StillCamera();
		stillCamera.takeImage().then(image => {
			fs.writeFileSync(filename, image);
			identify(imageid, filename);
			imageid = imageid +1;
			});
*/
/*			const streamCamera = new StreamCamera({
				codec: Codec.MJPEG
				});
			console.log('codec set')
			await streamCamera.startCapture();
			streamCamera.takeImage().then(image => {
				console.log('stream image taken set')
				fs.writeFileSync(filename, image);
				identify(imageid, filename);
				imageid = imageid +1;
				await streamCamera.stopCapture();
			});
*/

	}
}

function identify (id, path) {
	console.log (openalpr.IdentifyLicense (path, function (error, output) {
		var results = output.results;
		console.log (id +" "+ output.processing_time_ms +" "+ ((results.length > 0) ? results[0].plate : "No results"));
		console.log(results);
		var currentplate = 0;
		if (results.length == 0) {
			query = "insert into plates ( filename, processtime, plate, confidence,streammode,sensormode) values ('"+path+"','','','0',"+bStreamMode+","+iStreamSensorMode+");";
			console.log(query);
			db.run(query);
			}
		while ((results.length > 0) && (currentplate<results.length)) {
			query = "insert into plates ( filename, processtime, plate, confidence,streammode,sensormode) values ('"+path+"','"+ output.processing_time_ms+"','"+results[currentplate].plate+"','"+results[currentplate].confidence+"',"+bStreamMode+","+iStreamSensorMode+");";
			console.log(query);
			db.run(query);
			currentplate++;
		}
	
	}));
}

var a;
a = openalpr.Start ();
console.log(a);
a=openalpr.GetVersion ();
console.log(a);

//identify (0, "ea7the.jpg");
setInterval(ShootAndAssess, 15*1000);
