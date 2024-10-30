//----------------------------------------------------------------------
// Require module
//----------------------------------------------------------------------
const fs = require('fs');

//----------------------------------------------------------------------
// Setting value
//----------------------------------------------------------------------
const heldArrayNum = 5;	// number of array holding estimated beacon position

const startIntervening		= 1;
const Intervening			= 2;
const startNotIntervening	= 3;
const notIntervening		= 4;

const startOperating	= 1;
const operating			= 2;
const startNotOperating	= 3;
const notOperating		= 4;
const startTrouble		= 5;
const trouble			= 6;

//----------------------------------------------------------------------
// Declare variable and array
//----------------------------------------------------------------------
var sensorConfig;			// array that store sensor configuration
var areaStatus;				// array that store area status
var areaStatusChange;		// array that store only changed area stauts

//----------------------------------------------------------------------
// Modularized method
//----------------------------------------------------------------------
exports.init = function(sc) { // method to initialize logic (call once after startup)
	readSensorConfig(sc);
	initArray();
}

exports.estimate = function(disValue,pirValue) { // method to estimate (call when estimating)
	
	
	// //人感センサ
	var flag = canEstimate(pirValue,'pir');
	var estimatedPosition = estimatePosition(pirValue, flag);
	// console.log(estimatedPosition);
	areaStatusChangepir = estimateAreaStatusChangePir(estimatedPosition);
	// console.log('エリアの変化情報');
	// console.log(areaStatusChange);
	storeAreaStatus(estimatedPosition);
	// // console.log('エリアの情報');
	// // console.log(areaStatus);


	// 距離センサ
	var flag1 = canEstimate(disValue, 'dis');
	var opeStatusdis = estimateOpeStatusdis(disValue, flag1);
	areaStatusChangedis = estimateAreaStateChangedis(opeStatusdis);
	storeAreaStatusdis(opeStatusdis);


	areaStatusChange = mergeArray(areaStatusChangedis,areaStatusChangepir);
	// console.log("areastatusの表示開始")
	// console.log(areaStatusChange)
	// console.log("areastatusの表示終了")

}

exports.returnStatus = function() { // method to return area status (call when sending to cloud)
	return areaStatus;
}

exports.returnStatusChange = function() { // method to return only changed area status (call when estimating)
	return areaStatusChange;
}

//----------------------------------------------------------------------
// Method
//----------------------------------------------------------------------
function readSensorConfig(sc) { // method to read sensor configuration
	sensorConfig = sc;
}

function initArray() { // method to initialize array
	beaconPosition = Array(sensorConfig['beacon'].length);
	beaconPositionArray = Array(sensorConfig['beacon'].length);
	areaStatus = Array(sensorConfig['area'].length);
	areaStatusChange = Array();
	for(var i in sensorConfig['beacon']) { beaconPosition[i] = -1; }
	for(var i in sensorConfig['beacon']) { beaconPositionArray[i] = Array(); }
	for(var i in sensorConfig['area']) { 
		areaStatus[i] = { id:sensorConfig['area'][i]['id'], operatingStatus:0, beacon:[] }; }
		// areaStatus[i] = { date:'',id:sensorConfig['area'][i]['id'], interveningStatus:0, beacon:[] }; }
}

function canEstimate(value, type) { // method to decide whether operating status can be estimated
	var flag = Array(sensorConfig['area'].length);
	for(var i in sensorConfig['area']) {
		if(value[i].length >= sensorConfig['length'][type]) {
			flag[i] = true;
		}
		else {
			flag[i] = false;
		}
	}
	return flag;
}

// function canEstimatePir(pirValue, flag) { // method to decide whether interveningstatus status can be estimated by pir-motion sensor -> flag['pir index'] = true or false
// 	var flag = Array(sensorConfig['area'].length);
// 	for(let i in sensorConfig['area']) {
// 		if(pirValue[i].length >= sensorConfig['length']['pir']) {
// 			flag[i] = true;
// 		}
// 		else {
// 			flag[i] = false;
// 		}
// 	}
// 	return flag;
// }

function estimatePosition(pirValue, flag) {
	positionStatus = Array(sensorConfig['area'].length);
	for(var i in sensorConfig['area']) {
		if(flag[i]) {
			var pirArray = Array(sensorConfig['length']['pir']);
			for(var j in pirValue[i]) {
				pirArray[j] = pirValue[i][j]['state'];
			}
			var pirStatus = calculateMode(pirArray);
			if(pirStatus == 1) {
				// console.log('人感センサ' + sensorConfig['area'][i]['pir'] + '反応中');
				positionStatus[i] = 2;
			} else {
				// console.log('人感センサ' + sensorConfig['area'][i]['pir'] + '無反応');
				positionStatus[i] = 4;
			}
			console.log(`
			【人感センサ】
			シリアル番号　　　：　${sensorConfig['area'][i]['pir']}
			推定結果　　　　　：　${positionStatus[i]}
			`);
		}else{
			positionStatus[i] = 0;
		}
	}
	return positionStatus;
}

// 位置が変わったときに送るデータを作る
function estimateAreaStatusChangePir(pc) {
	var asChange = Array();
	for(var i in pc) {
		if(pc[i] != areaStatus[i]['interveningStatus']){
			// asChange.push({ date:'',id:sensorConfig['area'][i]['id'], interveningStatus: pc[i] - 1, beacon: []});
			asChange.push({ id:sensorConfig['area'][i]['id'], operatingStatus: pc[i] - 1, beacon: []});
		}
	}
	return asChange;
}

function storeAreaStatus(pc) {
	for(var i in areaStatus) {
		if(pc[i] != undefined)
			areaStatus[i]['interveningStatus'] = pc[i];
	}
}

function mergeArray(disArray,pirArray) {

		var arr = Array();
		
		for(var i=0; i<disArray.length; i++) {
			arr.push(disArray[i]);
		}
		for(var i=0; i<pirArray.length; i++) {
			arr.push(pirArray[i]);
		}
		return arr;
	}

//----------------------------------------------------------------------
// 距離センサ
//----------------------------------------------------------------------
function estimateOpeStatusdis(disValue, flag) {
	var opeStatus = Array(sensorConfig['area'].length);
	for(var i in sensorConfig['area']) {
		if(flag[i]) {
			//移動平均を計算した距離しきい値より低いとき
			if(calculateAve(disValue[i], "distance") < sensorConfig['area'][i]['threshold']) { 
				opeStatus[i] = operating;
				ave2=calculateAve(disValue[i],"distance");
				
			}
			else {
				opeStatus[i] = notOperating;
			
				ave2=calculateAve(disValue[i],"distance");
				
			}
			
			console.log(`
			【距離センサ】
			シリアル番号　　　：　${sensorConfig['area'][i]['dis']}
			設定したしきい値　：　${sensorConfig['area'][i]['threshold']}
			センサ値（平均）　：　${ave2}
			推定結果　　　　　：　${opeStatus[i]}
			`);
		}
	
		else {
			opeStatus[i] = 0;
		}
	}
	// console.log(opeStatus)
	return opeStatus;
	
}

function estimateAreaStateChangedis(opeStatus) {
	var msChange = Array();
	for(var i in sensorConfig['area']) {
		if(opeStatus[i] != 0) {
			//console.log("第一段階クリア");
			if(areaStatus[i]['operatingStatus'] != opeStatus[i]) {
				//console.log("第二段階クリア");
				msChange.push({ id:sensorConfig['area'][i]['id'], operatingStatus:opeStatus[i]-1, trouble:0 })
				//for(i;i<3;i++){
				//	opeStatus[i]=2;

				//}
			}
		}
	}
	return msChange;
}

function storeAreaStatusdis(opeStatus) {
	for(var i in sensorConfig['area']) {
		if(opeStatus[i] != 0) {
			areaStatus[i]['operatingStatus'] = opeStatus[i];
		}
	}
}

//----------------------------------------------------------------------------------------
// Utility
//----------------------------------------------------------------------------------------
function calculateAve(value, key) { // method to calculate average
	var sum = 0;
	var ave = 0;
	for(var i=0; i<value.length; i++) {
		sum = sum + value[i][key];
	}
	ave = sum / value.length;
	return ave;
}

function calculateRate(value) { // method to calculate rate of array
	var sum = 0;
	var rateArray = Array(value.length);
	for(var i=0; i<value.length; i++) {
		sum = sum + value[i];
	}
	for(var i=0; i<value.length; i++) {
		rateArray[i] = value[i] / sum;
	}
	return rateArray;
}

function calculateMode(value) { // method to calculate mode of array
	var counter = {};
	var maxValue = -1;
	var maxCounter = 0;
	for(var i=0; i<value.length; i++){
		if(!counter[value[i]]) {
			counter[value[i]] = 0;
		}
		counter[value[i]] = counter[value[i]] + 1;
		for (var j=0; j<Object.keys(counter).length; j++){
			key = Object.keys(counter)[j];
			if(counter[key] > maxCounter){
				maxValue = key;
				maxCounter = counter[key];
			}
		}
	}
	return maxValue;
}

function deleteStringInArray(arr, str) { // delete specific string in array
	var index = arr.indexOf(str);
	if(index >= 0) {
		arr.splice(index, 1);
	}
	return arr;
}



