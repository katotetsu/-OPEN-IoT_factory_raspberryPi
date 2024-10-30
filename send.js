//----------------------------------------------------------------------
// Setting value
//----------------------------------------------------------------------
const isKeepingStatusChange = true;
const isKeepingStatus = false;

//----------------------------------------------------------------------
// Require module
//----------------------------------------------------------------------
var net = require('net');
require('date-utils');
var request = require('request');
const { EventHubClient } = require("@azure/event-hubs");

//----------------------------------------------------------------------
// Declare variable and array
//----------------------------------------------------------------------
var beaconTag;
var factoryId;
var cloudConfig;
var keepedFailedData = ''; //送信失敗したデータを格納
var latestTime; // クラウドの最新時間

// Define connection string and the name of the Event Hub
const connectionString = "ENDPOINT";
const eventHubsName = "HUBNAME";

//----------------------------------------------------------------------
// Modularized method
//----------------------------------------------------------------------
exports.init = function(id, config) { // method to initialize logic (call once after startup)
	readFactoryId(id);
	readCloudConfug(config);
	initBeaconTag();
	latestTime = new Date();
}

exports.sendStatusChange = function(machineArray, areaArray) {
	var arr1 = formatArray(machineArray, areaArray);
	var arr2 = addDate(arr1);
	var data = formatString(arr2);
	send(data, keepedFailedData, isKeepingStatusChange, keepFailedData); //引数：（文字列、文字列、保持フラグ、保持関数）
}

exports.sendStatus = function(machineArray, areaArray) {
	var arr1 = formatArray(machineArray, areaArray);
	var arr2 = addDate(arr1);
	var data = formatString(arr2);
	send(data, keepedFailedData, isKeepingStatus, keepFailedData); //引数：（文字列、文字列、保持フラグ、保持関数）
}

//----------------------------------------------------------------------
// Method
//----------------------------------------------------------------------
function readFactoryId(id) { // method to read factory id
	factoryId = id;
}

function readCloudConfug(config) { // method to read cloud configuration
	cloudConfig = config;
}

function initBeaconTag() {
	beaconTag = 'B' + factoryId.substr(1,2);
}

function formatArray(mArr, aArr) { // method to format for transmission
	var arr = Array();
	var operatingStatus;
	var trouble;
	var interveningStatus;
	for(var i in mArr) {
		if(mArr[i]['operatingStatus']!=0 || mArr[i]['trouble']!=0) {
			if(mArr[i]['operatingStatus'] != 0) { operatingStatus = mArr[i]['operatingStatus']; }
			else { operatingStatus = ''; }
			if(mArr[i]['trouble'] != 0) { trouble = mArr[i]['trouble']; }
			else { trouble = ''; }
			var data = factoryId+','+mArr[i]['id']+','+operatingStatus+','+trouble+','+',,,';
			arr.push(data);
		}
	}
	for(var i in aArr) {
		if(aArr[i]['operatingStatus']!=0 || aArr[i]['trouble']!=0) {
			if(aArr[i]['operatingStatus'] != 0) { operatingStatus = aArr[i]['operatingStatus']; }
			else { operatingStatus = ''; }
			if(aArr[i]['trouble'] != 0) { trouble = aArr[i]['trouble']; }
			else { trouble = ''; }
			var data = factoryId+','+',,,'+aArr[i]['id']+','+operatingStatus+','+','+','+',,,';
			// console.log(data)
			arr.push(data);
		}
	}
	return arr;
}

function addDate(arr) { // method to add date
	var date = new Date();
	if((date-latestTime) <= 0) {
		date.setMilliseconds(date.getMilliseconds()+((date-latestTime)*-1));
	}

	for(var i in arr) {
		date.setSeconds(date.getSeconds()+1);
		arr[i] = date.toFormat("YYYY/MM/DD HH24:MI:SS") + ',' + arr[i];
	}
	latestTime = date;
	return arr;
}

function formatString(arr) {
	var data = '';
	for(var i in  arr) {
		data = data + arr[i] + '\r\n';
	}
	return data;
}

function keepFailedData(isKeep, httpResult, data){ // method to keep failed data
	if (isKeep && httpResult == 'Er'){
		console.log('送信に失敗！　送信に失敗したデータを保持しました。')
		keepedFailedData += data;
		console.log('########################################################################');
		console.log('現在保持している送信に失敗したデータ　：　');
		console.log('------------------------------------');
		console.log(keepedFailedData);
		console.log('########################################################################');
	}
	if (isKeep && httpResult == 'OK'){ //直すーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
		console.log('送信に成功！　保持していたデータの初期化を行いました。');
		console.log('########################################################################');
		console.log('現在保持している送信に失敗したデータ　：　');
		console.log('------------------------------------');
		keepedFailedData = '';
		console.log('########################################################################');
		console.log(keepedFailedData);
	}
	if(!isKeep && httpResult == 'OK'){
		console.log('送信に成功！　データ保持設定は無効です。');
	}
	if(!isKeep && httpResult == 'Er'){
		console.log('送信に失敗！　データ保持設定無効のためデータが欠落します。');
	}
}


async function send(data, keepedFailedData, isKeep, callback){
	// ConnectionString
	const client = EventHubClient.createFromConnectionString(connectionString, eventHubsName);

	// Header of CSV , sample data
	const csvHeader = 'date_time,factory_id,machine_id,operating_status,trouble,area_id,intervening_state,beacon';
	var csvData = keepedFailedData + data;
	// Format to JSON form CSV (String)

	if (csvData){ 
		let keys = csvHeader.split(","); // keys[0] => 'date_time' ~ keys[7] => 'beacon' 
	
		// console.log(csvData);
		// Split csvData to make a two-dimensional array
		let splitedCsvData = csvData.split(/,|\r\n/);

		// Make a two-dimensional array with splice
		let arr = new Array();
		while(splitedCsvData[0]) {
		    let tmp = splitedCsvData.splice(0,9);
		    arr.push(tmp);
		}
		for (var i in arr){
		    // console.log(`arr: ${arr[i]}`);
		}

		// Make jsonString to parse json from string
		let jsonString = "";
		jsonString = "["
		for (var i in arr){
		    jsonString = jsonString + "{";
		    for (var j in keys){
    		    jsonString = jsonString + `"${keys[j]}":"${arr[i][j]}",` ;
    		}
    		jsonString = jsonString.slice(0, -1) + "},"; // 9個目の,消して}で閉じた
		}
		jsonString = jsonString.slice(0, -1) + "]"; // 最後の,消して]で閉じた
		jsonString = `{"body":${jsonString}}`; // bodyでpack
	

		// Make data to send 
		const eventData = JSON.parse(jsonString);
		console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
		console.log("クラウドへデータが送信されます．")
		var send_time = new Date();
		// send_time.setTime(send_time.getTime() + 1000*60*60*9);
		var send_time_toFormat =send_time.toFormat("YYYY/MM/DD HH24時MI分SS秒");
		console.log("送信時間：",send_time_toFormat)
		console.log("");
		console.log(eventData);
		console.log(`Sending message: ${eventData.body}`);
		console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")

		await client.send(eventData);
		await client.close();
	}else{
		// console.log("else route csvData");
	}
}
send().catch(err => {
	console.log("Error occurred: ", err);
  });

