const timestamp = require('time-stamp');
var openalpr = require ("node-openalpr");
var sqlite3 = require('sqlite3').verbose()

const { StillCamera, StreamCamera, Codec, SensorMode } = require("pi-camera-connect");

var db = new sqlite3.Database('plates.db');

var imageid =1;
var count=-1;
var interval=0;


const streamCamera = new StreamCamera({
    codec: Codec.MJPEG,
    fps: 90,
    sensorMode: SensorMode.Mode6
});

function identify (id, path) {
	console.log (openalpr.IdentifyLicense (path, function (error, output) {
		var results = output.results;
		console.log (id +" "+ output.processing_time_ms +" "+ ((results.length > 0) ? results[0].plate : "No results"));
		console.log(results);
		var currentplate = 0;
		if (results.length == 0) {
			query = "insert into plates ( filename, processtime, plate, confidence,streammode,sensormode) values ('"+path+"','"+ output.processing_time_ms +"','','0','1','6');";
			console.log(query);
			db.run(query);
			}
		while ((results.length > 0) && (currentplate<results.length)) {
			query = "insert into plates ( filename, processtime, plate, confidence,streammode,sensormode) values ('"+path+"','"+ output.processing_time_ms+"','"+results[currentplate].plate+"','"+results[currentplate].confidence+"','1','6');";
			console.log(query);
			db.run(query);
			currentplate++;
        }
        //run prescribed number of times.  If its -1, run indefinitely
        if ((imageid<=count)||(count==-1)) {
            //just pause between shots if not maximizing FPS
            setTimeout(shoot, interval*1000);
        }
        else { process.exit(0);}
	
	}));
}





var a;
a = openalpr.Start ();
console.log(a);
a=openalpr.GetVersion ();
console.log(a);

//identify (0, "ea7the.jpg");
//setInterval(ShootAndAssess3, 15*1000);

function shoot() {

    var filename = './images/img'+timestamp('YYYYMMDDHHmmss')+'.jpg';
    startTime = new Date();
    streamCamera.takeImage().then(image => {
        stopTime = new Date();
        console.log(filename);
        fs.writeFileSync(filename, image);
        identify(imageid, filename);
        imageid = imageid +1;
        });
    

}


const runApp = async () => {
    
    await streamCamera.startCapture();

    shoot();    
};

var myArgs = process.argv.slice(2);
console.log('myArgs: ', myArgs);
//lets specify two variables, count= and interval=
//interval is in seconds
for (var i = 0; i < myArgs.length; i++) {
    if (myArgs[i].indexOf('count=') == 0) {
        count=parseInt(myArgs[i].split('=')[1])
        if (isNaN(count)) {count=-1}
//        console.log(count)
    }
    if (myArgs[i].indexOf('interval=') == 0) {
        interval=parseInt(myArgs[i].split('=')[1])
        if (isNaN(interval)) {interval=0}
//        console.log(interval)
    }
  }
console.log("interval "+interval+" count "+count)


runApp();
