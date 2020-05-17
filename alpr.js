var openalpr = require ("node-openalpr");
var sqlite3 = require('sqlite3').verbose()

var db = new sqlite3.Database('plates.db');

function identify (id, path,timestamp) {
	openalpr.IdentifyLicense (path, function (error, output) {
		var results = output.results;
		var currentplate = 0;
		if (results.length == 0) {
			query = "update plates set processtime ="+ output.processing_time_ms +",confidence=0 where id = "+id+";";
			//console.log(query);
			db.run(query);
			}
		while ((results.length > 0) && (currentplate<results.length)) {
            if (currentplate == 0) {
                query = "update plates set processtime="+ output.processing_time_ms+", plate='"+results[currentplate].plate+"' , confidence='"+results[currentplate].confidence+"' where id = "+id+";";
            }
            else {
                query = "insert into plates ( filename, processtime, plate, confidence,timestamp) values ('"+path+"','"+ output.processing_time_ms+"','"+results[currentplate].plate+"','"+results[currentplate].confidence+"','"+timestamp+"');";
            }
			//console.log(query);
			db.run(query);
			currentplate++;
        }
        process.send({ status: 'done', id: id });
	});
}

process.on('message', (m) => {
    strQuery="select filename,timestamp from plates where id="+m.id;
    db.all(strQuery, function(err, rows) {
        identify(m.id,rows[0].filename,rows[0].timestamp);
    });

});
  
var a;
a = openalpr.Start ();
console.log("Open ALPR Start:" + a);
a=openalpr.GetVersion ();
console.log("Open ALPR Version:" + a);



