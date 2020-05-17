const cp = require('child_process');
const n = cp.fork('alpr.js');

n.on('message', (m) => {
  console.log('PARENT got message:', m);
  if (m.id==1721) {n.send({ id: 1722 });}
  if (m.id==1722) {n.send({ id: 1723 });}
  if (m.id==1723) {process.exit();}

});

n.send({ id: 1721 });
