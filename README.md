# Plates
Bicycle dashcam application, controllable via a browser/smartphone, capable of recognizing car license plates with OpenALPR, written in Node, for the Raspberry Pi
# Getting it running
Tested on a Raspberry Pi with the V1.3 Pi Camera running Raspbian GNU/Linux 9 (stretch) and node v8.11.1.

Require the standard time-stamp, express, sqlite3 libraries

It also requires pi-camera-connect and node-openalpr, which didn't run out of the box on my Pi.

I used pi-camera-connect from https://github.com/servall/pi-camera-connect
I had to make the changes described in this issue to make it work: https://github.com/servall/pi-camera-connect/issues/1

I used this version of node-alpr, which resolved a segfault issue I was getting:
https://github.com/sneko/node-openalpr
But it wouldn't install!  So I took the package.json that made it install from this version https://github.com/bameyrick/node-openalpr.git
