//----------------------------------------------------------------------
// Set constant
//----------------------------------------------------------------------
const intervalEstimate		= 5 * 1000;		// interval to estimate
const intervalSend			= 480 * 1000;	// interval to send
const intervalCheckValues	= 180 * 1000;	// interval to check sensor value
const timeHoldValue			= 300 * 1000;	// time to hold sensor value

//----------------------------------------------------------------------
// Require module
//----------------------------------------------------------------------
var net = require('net');
require('date-utils');

//----------------------------------------------------------------------
// Read configuration file
//----------------------------------------------------------------------
var sensorConfig = require('/home/pi/kk/config/sensor.json');
//var cloudConfig = require('/home/pi/kk/config/cloud.json');

//----------------------------------------------------------------------
// Read JS file
//----------------------------------------------------------------------
var sendJs = require('/home/pi/kk/send.js');

//----------------------------------------------------------------------
// Read logic file
//----------------------------------------------------------------------
var opeLogic = require('/home/pi/kk/logic/kkOpeLogic.js');
var pirLogic = require('/home/pi/kk/logic/pirLogic.js');
//----------------------------------------------------------------------
// Declare array
//----------------------------------------------------------------------
var machineId;	// araay that store machine's id	-> machineId[i] = 'MXX000'
var areaId;		// araay that store area's id		-> areaId[i] = 'AXX000'

var opeId;	// araay that store operating status sensor's id	-> opeId['machine index'] = '000000'
var ligId;	// araay that store light sensor's id				-> ligId['machine index'] = '000000'
var swiId;	// araay that store switch's id						-> swiId['machine index'] = '000000'
var pirId;	// araay that store pir motion sensor's id			-> pirId['area index'] = '000000'
var beaId;	// araay that store beacon's id						-> beaId['beacon index'] = '000000'
var recId;	// araay that store beacon receiver's id			-> recId['receiver index'] = 'BXX000'
var disId;

var opeValue;	// araay that store operating status sensor's value	-> opeValue['machine index'][data index] = {time:YYYY-MM-DDTHH:MI:SS.MISS HH24:MI:SS, ave:0, var:0}
var ligValue;	// araay that store light sensor's value			-> ligValue['machine index'][data index] = {time:YYYY-MM-DDTHH:MI:SS.MISS HH24:MI:SS, lig1:0, lig2:0, lig3:0} 
var swiValue;	// araay that store switch's value					-> swiValue['machine index'][data index] = {time:YYYY-MM-DDTHH:MI:SS.MISS HH24:MI:SS, last:0}	// I will change this code
var pirValue;	// araay that store pir motion sensor's value		-> pirValue['area index'][data index] = {time:YYYY-MM-DDTHH:MI:SS.MISS HH24:MI:SS, status:0}
var beaValue;	// araay that store beacon's value					-> beaValue['beacon index']['receiver index'][data index] = {time:YYYY-MM-DDTHH:MI:SS.MISS HH24:MI:SS, rssi:0}
var disValue;

//----------------------------------------------------------------------
// Main
//----------------------------------------------------------------------



// Initialize array
initArray();

// connect with middleware and beacon receiver and receive data
receiveMiddleware();

// Initialize sendJs
sendJs.init(sensorConfig['factory'], cloudConfig);

// Initialize logic
opeLogic.init(sensorConfig);
pirLogic.init(sensorConfig);

// estimate status and send to cloud when status change
setInterval(function() {
	var now = new Date();
	// now.setTime(now.getTime() + 1000*60*60*9);
	var now_toFormat =now.toFormat("YYYY/MM/DD HH24時MI分SS秒");
	// outputValue();
	console.log("==================================================================")
	console.log('推定開始時間：',now_toFormat);
	opeLogic.estimate( ligValue, swiValue,opeValue);
	// pirLogic.estimate(pirValue);
	pirLogic.estimate(disValue,pirValue);
	var opeStatusChange = opeLogic.returnStatusChange();
	var pirStatusChange = pirLogic.returnStatusChange();
	// console.log('変化時送信開始->');
	// console.log(`opeStatusChange ${opeStatusChange}`);
	// console.log(`pirStatusChange ${pirStatusChange}`);
	sendJs.sendStatusChange(opeStatusChange, pirStatusChange);
	console.log("==================================================================")

}, intervalEstimate);

// send to cloud
setInterval(function() {
	// console.log('定期送信開始->');
	var opeStatus = opeLogic.returnStatus();
	var pirStatus = pirLogic.returnStatus();
	// console.log('定期送信開始->');
	// console.log(opeStatus);
	// console.log(pirStatus);
	sendJs.sendStatus(opeStatus, pirStatus);
}, intervalSend);

// delete old sensor value
setInterval(function() {
	console.log('データチェック開始');
	deleteOldValue();
}, intervalCheckValues)



//----------------------------------------------------------------------
// Method
//----------------------------------------------------------------------
function initArray() { // method to initialize array
	machineId = new Array();
	areaId = new Array();
	for(var i in sensorConfig['machine']) { machineId.push(sensorConfig['machine'][i]['id']); }
	for(var i in sensorConfig['area']) { areaId.push(sensorConfig['area'][i]['id']); }

	opeId = Array();
	ligId = Array();
	swiId = Array();
	pirId = Array();
	beaId = Array();
	recId = Array();
	disId = Array();
	for(var i in sensorConfig['machine']) { 
		opeId.push(sensorConfig['machine'][i]['ope']);
		ligId.push(sensorConfig['machine'][i]['lig']);
		swiId.push(sensorConfig['machine'][i]['swi']);
		// disId.push(sensorConfig['machine'][i]['dis']);
	}
	for(var i in sensorConfig['area']) { 
		pirId.push(sensorConfig['area'][i]['pir']);
		disId.push(sensorConfig['area'][i]['dis']);
	 }
	for(var i in sensorConfig['beacon']) { beaId.push(sensorConfig['beacon'][i]); }
	for(var i in sensorConfig['receiver']) { recId.push(sensorConfig['receiver'][i]); }

	opeValue = new Array();
	ligValue = new Array();
	swiValue = new Array();
	pirValue = new Array();
	beaValue = new Array();
	disValue = new Array();
	for(var i in sensorConfig['machine']) { 
		opeValue[i] = new Array();
		ligValue[i] = new Array();
		swiValue[i] = new Array();
		// disValue[i] = new Array();
	}
	for(var i in sensorConfig['area']) {
	 pirValue[i] = new Array();
	 disValue[i] = new Array();
	 }
	for(var i in sensorConfig['beacon']) { beaValue[i] = new Array(); for(var j in sensorConfig['receiver']) { beaValue[i][j] = new Array(); } }

	// console.log("disValueのテスト");
	// console.log(disValue);
}

function receiveMiddleware() { // method to connect with middleware and receive data
	var client = new net.Socket();
	client.setEncoding('utf8');
	client.connect(8566, 'localhost', function() {
		console.log('client -> connected to server');
	});
	client.on('data', function(data) {
		storeMiddleware(data);
		//console.log(data);
	});
	client.on('close', function() {
		console.log('client -> connection is closed');
	});
}

function storeMiddleware(data) { // method to store data received from middleware
	// data = data + '\r\n';
	var date = new Date();
	date.setTime(date.getTime() + 1000*60*60*9);
	var arr = data.split('\r\n');
	//arr.pop();
//	console.log(`STOREMIDDLEWARE: 
//	${arr}

//	`)
	for(var i in arr) {
		try {
			var json = JSON.parse(arr[i]);
			switch(json['type_sub']) {
				case sensorConfig['type']['ope']:
					var index = opeId.indexOf(json['serial']);
					opeValue[index].push({ time:date, ave:json['data']['average'], var:json['data']['variance'] });
					if(opeValue[index].length > sensorConfig['length']['ope']) { opeValue[index].shift(); }
					break;
				case sensorConfig['type']['lig']:
					var index = ligId.indexOf(json['serial']);
					ligValue[index].push({ time:date, lig1:json['data']['light1c'], lig2:json['data']['light2c'], lig3:json['data']['light3c'] });
					if(ligValue[index].length > sensorConfig['length']['lig']) { ligValue[index].shift(); }
					break;
				case sensorConfig['type']['swi']:
					var index = swiId.indexOf(json['serial']);
					swiValue[index].push({ time:date, last:json['data']['last'], sw1:json['data']['state']['sw1'], sw2:json['data']['state']['sw2'], sw3:json['data']['state']['sw3'], sw4:json['data']['state']['sw4'] });
					if(swiValue[index].length > sensorConfig['length']['swi']) { swiValue[index].shift(); }
					break;
				case sensorConfig['type']['pir']:
					var index = pirId.indexOf(json['serial']);
					pirValue[index].push({ time:date, state:json['data']['state'] });
					if(pirValue[index].length > sensorConfig['length']['pir']) { pirValue[index].shift(); }
					break;
				case sensorConfig['type']['dis']:
					var index = disId.indexOf(json['serial']);
					disValue[index].push({ time:date, distance:json['data']['distance'] });
					if(disValue[index].length > sensorConfig['length']['dis']) { disValue[index].shift(); }
					// console.log("STOREMIDDLEWAREのテスト");
					// console.log(disValue);
					break;
			}
		} catch(e) {
			console.log('err -> storeMiddleware');
			//console.log(data);
		}
	}
}

function storeBeaconreceiver(data) { // method to store data received from beacon receiver
	// data = data + '\r\n';
	var date = new Date();
	date.setTime(date.getTime() + 1000*60*60*9);
	var arr = data.split('\r\n');
	arr.pop();
	for(var i in arr) {
		try {
			var json = JSON.parse(arr[i]);
			var indexBea = beaId.indexOf(json['serial']);
			var indexRec = recId.indexOf(json['hostname']);
			beaValue[indexBea][indexRec].push({ time:date, rssi:json['rssi'] });
			if(beaValue[indexBea][indexRec].length > sensorConfig['length']['bea']) { beaValue[indexBea][indexRec].shift(); }
		} catch(e) {
			console.log('err -> storeBeaconreceiver');
			// console.log(data);
		}
	}
}

function deleteOldValue() { // method to delete old sensor value
	var date = new Date();
	date.setTime(date.getTime() + 1000*60*60*9);
	for(var i in opeValue) { if(opeValue[i].length > 0) { if(date-opeValue[i][0]['time'] > timeHoldValue) { opeValue[i] = []; } } }
	for(var i in ligValue) { if(ligValue[i].length > 0) { if(date-ligValue[i][0]['time'] > timeHoldValue) { ligValue[i] = []; } } }
	for(var i in swiValue) { if(swiValue[i].length > 0) { if(date-swiValue[i][0]['time'] > timeHoldValue) { swiValue[i] = []; } } }
	for(var i in pirValue) { if(pirValue[i].length > 0) { if(date-pirValue[i][0]['time'] > timeHoldValue) { pirValue[i] = []; }} }
	for(var i in beaValue) { for(var j in beaValue[i]) { if(beaValue[i][j].length > 0) { if(date-beaValue[i][j][0]['time'] > timeHoldValue) { beaValue[i][j] = []; } } } }
}

//----------------------------------------------------------------------------------------
// Utility
//----------------------------------------------------------------------------------------
function outputId() { // Method to output log of id
	console.log('///////////////////////////////////////////////////////')
	console.log('machineId id');
	console.log(machineId);
	console.log('area id');
	console.log(areaId);
	console.log('operating status sensor id');
	console.log(opeId);
	console.log('light sensor id');
	console.log(ligId);
	console.log('switch id');
	console.log(swiId);
	console.log('pir motion sensor id');
	console.log(pirId);
	console.log('beacon id');
	console.log(beaId);
	console.log('beacon receiver id');
	console.log(recId);
	console.log('///////////////////////////////////////////////////////')
}

function outputValue() { // Method to output log of value
	console.log('///////////////////////////////////////////////////////')
	console.log('operating status sensor value');
	console.log(opeValue);
	console.log('light sensor value');
	console.log(ligValue);
	console.log('switch value');
	console.log(swiValue);
	console.log('pirs sensor value');
	console.log(pirValue);
	console.log('beacon value');
	for(var i=0; i<Object.keys(sensorConfig['beacon']).length; i++) { console.log(beaValue[i]); }
	console.log('///////////////////////////////////////////////////////');
}

// 
// websocket
var fs = require('fs');
require('date-utils');
var webSocketServer = require('websocket').server;
var http = require('http');
var net = 3611;

var server = http.createServer(function(request, response){
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(net, function(){
    console.log((new Date()) + ' Server is listening on port ' + net);
});

wsServer = new webSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

function originIsAllowed(origin){
    return true;
}

connect = 0;

wsServer.on('request', function(request){
    connect++;
    if(!originIsAllowed(request.origin)){
        request.reject();
        return;
    }

    var connection = request.accept('echo-protocol', request.origin);
    connection.on('message', function(message){
        if(message.type === 'utf8'){
            storeBeaconreceiver(message.utf8Data);
            connection.sendUTF(message.utf8Data);
        }
        else if (message.type === 'binary'){
            connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description){
        connect--;
    });
});

setInterval(function(){
    global.gc();
    console.log('GC DONE');
}, 30*1000); 
