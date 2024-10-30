//----------------------------------------------------------------------
// Setting value
//----------------------------------------------------------------------
const startOperating	= 1;
const operating			= 2;
const startNotOperating	= 3;
const notOperating		= 4;
const startTrouble		= 5;
const trouble			= 6;
const startPStop        = 7;
const PStop             = 8;

//----------------------------------------------------------------------
// Declare variable and array
//----------------------------------------------------------------------
var sensorConfig;			// array that store sensor configuration
var machineStatus;			// array that store latest machine status
var machineStatusChange;	// array that store only changed machine stauts
var swiValueCount;			// 
var swiValuelast;			// 

//----------------------------------------------------------------------
// Modularized method
//----------------------------------------------------------------------
exports.init = function(sc) { // method to initialize logic (call once after startup)
	readSensorConfug(sc);
	initArray();
}

//【0】使うセンサだけ選んで
exports.estimate = function(ligValue,swiValue,opeValue) { // method to estimate (call when estimating)

	//【1】使うスイッチだけを選ぶのだ

	//スイッチ
	var flag3 = canEstimate(swiValue, 'swi');
	var opeStatusSwi = estimateOpeStatusSwi(swiValue, flag3);
	machineStatusChangeSwi = estimateMachineStateChangeSwi(opeStatusSwi);
	storeMachineStatusSwi(opeStatusSwi);

	// 稼働状態センサ
	var flag1 = canEstimate(opeValue, 'ope');
	var opeStatusOpe = estimateOpeStatusOpe(opeValue, flag1);
	machineStatusChangeOpe = estimateMachineStateChangeOpe(opeStatusOpe);
	storeMachineStatusOpe(opeStatusOpe);

	// 光センサ
	var flag2 = canEstimate(ligValue, 'lig');
	var opeStatusLig = estimateOpeStatusLig(ligValue, flag2);
	machineStatusChangeLig = estimateMachineStateChangeLig(opeStatusLig);
	storeMachineStatusLig(opeStatusLig);

	//【2】マージするセンサだけを選ぶのだ
	// 状態変化時の配列をマージ
	//距離，光，スイッチ全部のせ
	machineStatusChange = mergeArray(machineStatusChangeLig, machineStatusChangeSwi,machineStatusChangeOpe);

	/*確認テスト*/
	// console.log('結果出力');
	// console.log(machineStatus);
	// console.log(machineStatusChange);
	// console.log('Switch');
	// console.log('スイッチのプッシュ状態');
	// console.log(opeStatusSwi);
	// console.log('スイッチによる機械状態変化');
	// console.log(machineStatusChangeSwi);
	// console.log('Light sensor');
	// console.log('光センサの推定結果');
	// console.log(opeStatusLig);
	// console.log('光センサによる機械状態変化');
	// console.log(machineStatusChangeLig);
}

exports.returnStatus = function() {// method to return machine status (call when sending to cloud)
	return machineStatus;
}

exports.returnStatusChange = function() { // method to return only changed machine status (call when estimating)
	return machineStatusChange;
}

//----------------------------------------------------------------------
// Method
//----------------------------------------------------------------------
function readSensorConfug(sc) { // method to read sensor configuration
	sensorConfig = sc;
}

function initArray() { // method to initialize array
	machineStatus = Array(sensorConfig['machine'].length);
	machineStatusChange = Array();
	for(var i in sensorConfig['machine']) { 
		machineStatus[i] = { id:sensorConfig['machine'][i]['id'], operatingStatus:0, trouble:0 };
	}
	swiValueCount = Array(sensorConfig['machine'].length);
	swiValuelast = Array(sensorConfig['machine'].length);
	for(var i in sensorConfig['machine']) {
		swiValueCount[i] = {sw1:0, sw2:0, sw3:0, sw4:0};
	}
}

function canEstimate(value, type) { // method to decide whether operating status can be estimated
	var flag = Array(sensorConfig['machine'].length);
	for(var i in sensorConfig['machine']) {
		if(value[i].length >= sensorConfig['length'][type]) {
			flag[i] = true;
		}
		else {
			flag[i] = false;
		}
	}
	return flag;
}
//【3】使うセンサだけ選ぶのだ
//距離，光
function mergeArray(ligArray, swiArray,opeArray) {
//距離，光，スイッチ全部のせ
// function mergeArray(disArray, ligArray, swiArray) {
	//【4】使うセンサのforだけ選ぶのだ
	var arr = Array();
	
	for(var i=0; i<swiArray.length; i++) {
		arr.push(swiArray[i]);
	}
	for(var i=0; i<ligArray.length; i++) {
		arr.push(ligArray[i]);
	}
	for(var i=0; i<opeArray.length; i++) {
		arr.push(opeArray[i]);
	}
	return arr;
}

//----------------------------------------------------------------------
// 稼働状態
//----------------------------------------------------------------------
function estimateOpeStatusOpe(opeValue, flag) {
	var opeStatus = Array(sensorConfig['machine'].length);
	for(var i in sensorConfig['machine']) {
		if(flag[i]) { 
			
			
			// この下のロジック変えてください。
			var ave3 = calculateAve(opeValue[i], 'var')
			if(calculateAve(opeValue[i], 'var') > sensorConfig['machine'][i]['threshold']) { 
				opeStatus[i] = operating;
			}
			else {
				opeStatus[i] = notOperating;
			}
			console.log(`
			【稼働状態センサ】
			シリアル番号　　　：　${sensorConfig['machine'][i]['ope']}
			設定したしきい値　：　${sensorConfig['machine'][i]['threshold']}
			センサ値（平均）　：　${ave3}
			推定結果　　　　　：　${opeStatus[i]}
			`);
		}
		else {
			opeStatus[i] = 0;
		}
	}
	return opeStatus;
}

function estimateMachineStateChangeOpe(opeStatus) {
	var msChange = Array();
	for(var i in sensorConfig['machine']) {
		if(opeStatus[i] != 0) {
			if(machineStatus[i]['operatingStatus'] != opeStatus[i]) {
				msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:opeStatus[i]-1, trouble:0 })
			}
		}
	}
	return msChange;
}

function storeMachineStatusOpe(opeStatus) {
	for(var i in sensorConfig['machine']) {
		if(opeStatus[i] != 0) {
			machineStatus[i]['operatingStatus'] = opeStatus[i];
		}
	}
}



//----------------------------------------------------------------------
// Switch　(トラブル要因)　ロジックによってはコメントアウトするんだよー
//----------------------------------------------------------------------
// function estimateOpeStatusSwi(swiValue, flag) {
// 	var opeStatus = Array(sensorConfig['machine'].length); // opeStatus['machine index'] = 0...未推定or変化なし，1...稼働開始，2...非稼働開始
// 	for(var i in sensorConfig['machine']) {
// 		if(flag[i]) {
// 			if(swiValuelast[i] == undefined) { // 初回推定は推定を行わない
// 				opeStatus[i] = 0; //未推定
// 			}
// 			else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 0) { // 2回目以降の推定&スイッチ値が0の時(スイッチビーコンは，起動後一度もボタンを押さないと0を飛ばす)
// 				opeStatus[i] = 0; // 未推定
// 			}
// 			else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] != swiValuelast[i]) { // 前回のスイッチ値と最新のスイッチ値が異なる時
// 				if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 1) {
// 					opeStatus[i] = 1; 
// 				}
// 				else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 2) {
// 					opeStatus[i] = 2;
// 				}
// 				else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 3) {
// 					opeStatus[i] = 3; 
// 				}
// 				else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 4) {
// 					opeStatus[i] = 4;
	
// 				}
// 			}
// 			else { // 前回と最新のボタン値が同じ時
// 				var swi = swiValue[i][sensorConfig['length']['swi']-1]['last'];
// 				if(swiValueCount[i]['sw'+swi] != swiValue[i][sensorConfig['length']['swi']-1]['sw'+swi]) {
// 					if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 1) {
// 						opeStatus[i] = 1; 
// 					}
// 					else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 2) {
// 						opeStatus[i] = 2; 
// 					}
// 					else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 3) {
// 						opeStatus[i] = 3; 
// 					}
// 					else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 4) {
// 						opeStatus[i] = 4; 
// 					}
// 				}
// 				else { // 最新スイッチ値のプッシュカウントが前回の推定時と同じ時
// 					opeStatus[i] = 0; //変化なし
// 				}
// 			}

// 			// データの格納
// 			swiValuelast[i] = swiValue[i][sensorConfig['length']['swi']-1]['last'];
// 			swiValueCount[i]['sw1'] = swiValue[i][sensorConfig['length']['swi']-1]['sw1'];
// 			swiValueCount[i]['sw2'] = swiValue[i][sensorConfig['length']['swi']-1]['sw2'];
// 			swiValueCount[i]['sw3'] = swiValue[i][sensorConfig['length']['swi']-1]['sw3'];
// 			swiValueCount[i]['sw4'] = swiValue[i][sensorConfig['length']['swi']-1]['sw4'];

// 			console.log(`
// 			【スイッチ】
// 			シリアル番号　　　：　${sensorConfig['machine'][i]['swi']}
// 			推定結果　　　　　：　${swiValuelast[i]}
// 			`);
// 		}
// 		else {
// 			opeStatus[i] = 0;
// 		}
// 	}
// 	return opeStatus;
// }

// function estimateMachineStateChangeSwi(opeStatus) {
// 	var msChange = Array();
// 	for(var i in sensorConfig['machine']) {
// 		if(opeStatus[i] != 0) { // 0（初期値）じゃないとき
// 			if(opeStatus[i] == 1) { // トラブルが 1 
// 				if(machineStatus[i]['trouble'] != 1) { // 直前がトラブル中だった場合
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:1, trouble:1 });
// 				 }
// 				 else { // 直前が稼働中だった場合
// 					// 一度、停止開始を挟んでから稼働開始を送る。可視化はトラブル値見るから必要ないけど一応
// 					// と思ったけど何もしない
// 				 	// msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:3, trouble:1 });
// 				 	// msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:1, trouble:1 });
// 				 }
// 			}
// 			else if(opeStatus[i] == 2){ // トラブルが 2 のとき
// 				if(machineStatus[i]['trouble'] == 1){// 直前が稼働中だった場合
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:5, trouble:2 });
// 				}
// 				else{ // 直前がトラブル中だった場合
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:1, trouble:1 });
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:5, trouble:2 });
// 				}
// 			}
// 			else if(opeStatus[i] == 3) { // トラブルが 3 のとき
// 				if(machineStatus[i]['trouble'] == 1) { // 直前が稼働中だった場合
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:5, trouble:3 });
// 				}
// 				else { // 直前がトラブル中だった場合
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:1, trouble:1 });
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:5, trouble:3 });				}
// 			}			
// 			else { // トラブルが 4 のとき
// 				if(machineStatus[i]['trouble'] == 1) { // 直前が稼働中だった場合
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:5, trouble:4 });
// 				}
// 				else { // 直前がトラブル中だった場合
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:1, trouble:1 });
// 					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:5, trouble:4 });				}
// 			}
// 		}
// 		else { // opeStatusが 0 のとき
// 			// 
// 		}
// 	}
// 	return msChange;
// }

// function storeMachineStatusSwi(opeStatus) { // method to format operating status and store array
// 	for(var i in sensorConfig['machine']) {
// 		if(opeStatus[i] != 0) {
// 			// machineStatus[i]['operatingStatus'] = opeStatus[i]+1;
// 			if(opeStatus[i] == 1){
// 				machineStatus[i]['operatingStatus'] = 2;
// 				machineStatus[i]['trouble'] = 1; // トラブル未発生時も 1 で
// 			}else{
// 				machineStatus[i]['operatingStatus'] = 6; // or 4 トラブル中　or 停止中
// 				machineStatus[i]['trouble'] = opeStatus[i];
// 			}
// 		}
// 	}
// }
//----------------------------------------------------------------------
// Switch　(2値のロジック)　ロジックによってはコメントアウトするんだよー
//----------------------------------------------------------------------
function estimateOpeStatusSwi(swiValue, flag) {
	var opeStatus = Array(sensorConfig['machine'].length); // opeStatus['machine index'] = 0...未推定or変化なし，1...稼働開始，2...非稼働開始
	for(var i in sensorConfig['machine']) {
		if(flag[i]) {
			if(swiValuelast[i] == undefined) { // 初回推定は推定を行わない
				opeStatus[i] = 0; //未推定
			}
			else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 0) { // 2回目以降の推定&スイッチ値が0の時(スイッチビーコンは，起動後一度もボタンを押さないと0を飛ばす)
				opeStatus[i] = 0; // 未推定
			}
			else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] != swiValuelast[i]) { // 前回のスイッチ値と最新のスイッチ値が異なる時
				if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 1) {
					opeStatus[i] = startOperating; // 稼働開始
				}
				else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 2) {
					opeStatus[i] = startOperating; // 稼働開始
				}
				else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 3) {
					opeStatus[i] = startNotOperating; // 非稼働開始
				}
				else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 4) {
					opeStatus[i] = startNotOperating; // 非稼働開始
				}
			}
			else { // 前回と最新のボタン値が同じ時
				var swi = swiValue[i][sensorConfig['length']['swi']-1]['last'];
				if(swiValueCount[i]['sw'+swi] != swiValue[i][sensorConfig['length']['swi']-1]['sw'+swi]) {
					if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 1) {
						opeStatus[i] = startOperating; // 稼働開始
					}
					else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 2) {
						opeStatus[i] = startOperating; // 稼働開始
					}
					else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 3) {
						opeStatus[i] = startNotOperating; // 非稼働開始
					}
					else if(swiValue[i][sensorConfig['length']['swi']-1]['last'] == 4) {
						opeStatus[i] = startNotOperating; // 非稼働開始
					}
				}
				else { // 最新スイッチ値のプッシュカウントが前回の推定時と同じ時
					opeStatus[i] = 0; //変化なし
				}
			}
			// データの格納
			swiValuelast[i] = swiValue[i][sensorConfig['length']['swi']-1]['last'];
			swiValueCount[i]['sw1'] = swiValue[i][sensorConfig['length']['swi']-1]['sw1'];
			swiValueCount[i]['sw2'] = swiValue[i][sensorConfig['length']['swi']-1]['sw2'];
			swiValueCount[i]['sw3'] = swiValue[i][sensorConfig['length']['swi']-1]['sw3'];
			swiValueCount[i]['sw4'] = swiValue[i][sensorConfig['length']['swi']-1]['sw4'];
			console.log(`
			【スイッチ】
			シリアル番号　　　：　${sensorConfig['machine'][i]['swi']}
			推定結果　　　　　：　${swiValuelast[i]}
			`);
		}
		else {
			opeStatus[i] = 0;
		}
	}
	return opeStatus;
}
function estimateMachineStateChangeSwi(opeStatus) {
	var msChange = Array();
	for(var i in sensorConfig['machine']) {
		if(opeStatus[i] != 0) { // opeStatusが稼働開始(1)，非稼働開始(3)の時
			if(opeStatus[i] == startOperating) { // 稼働開始(1)ボタンが押された時
				if(machineStatus[i]['operatingStatus'] != operating) { // 非稼働(4)or未推定(0)から稼働(2)になった時
					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:startOperating, trouble:0 });
				 }
				 else { // 稼働(2)から稼働(2)になった時，直前に停止開始を送る
				 	msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:startNotOperating, trouble:0 });
				 	msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:startOperating, trouble:0 });
				 }
			}
			else { // 非稼働開始(3)ボタンが押された時
				if(machineStatus[i]['operatingStatus'] != operating) { // 非稼働(4)or未推定(0)から非稼働(4)になった時
					// なにもしない
				}
				else { // 稼働(2)から非稼働(4)になった時
					msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:startNotOperating, trouble:0 });
				}
			}
		}
		else { // opeStatusが0の時
			// なんもしない
		}
	}
	return msChange;
}
function storeMachineStatusSwi(opeStatus) { // method to format operating status and store array
	for(var i in sensorConfig['machine']) {
		if(opeStatus[i] != 0) {
			machineStatus[i]['operatingStatus'] = opeStatus[i]+1;
		}
	}
}


//----------------------------------------------------------------------
// Light sensor 
//----------------------------------------------------------------------
function estimateOpeStatusLig(ligValue, flag) {
	var opeStatus = Array(sensorConfig['machine'].length);
	var tmp1
	var tmp2
	var tmp3
	for(var i in sensorConfig['machine']) {
		if(flag[i]) { // 光センサの情報が溜まっている時
			if(sensorConfig['machine'][i]['ligtype'] == 1) { // ランプの種類が1色ランプの時 完成
				var ave1 = calculateAve(ligValue[i], 'lig1');
				if(ave1 > sensorConfig['machine'][i]['threshold'][0]) { // 閾値を超えた時
					opeStatus[i] = operating; //稼働
					tmp1 = operating; 
				}
				else { // 閾値を超えなかった時
					opeStatus[i] = notOperating; // 非稼働
					tmp1 =notOperating;
				}
				console.log(`
			【光センサ】
			シリアル番号　　　：　${sensorConfig['machine'][i]['lig']}
			設定したしきい値左：　${sensorConfig['machine'][i]['threshold'][0]}
			センサ値（平均）左：　${ave1}
			推定結果　　　　左：  ${tmp1}
			`);
			}
			
			else if(sensorConfig['machine'][i]['ligtype'] == 2) { // ランプの種類が2色ランプの時　完成
				// console.log("kindal")
				var ave1 = calculateAve(ligValue[i], 'lig1');
				var ave3 = calculateAve(ligValue[i], 'lig3');
				// var tmp1
				// var tmp3
				if(ave3 > sensorConfig['machine'][i]['threshold'][2]) { // 赤色が閾値を超えた時
					opeStatus[i] = trouble; // トラブル中
					tmp3 = trouble;
					tmp1 =notOperating;
				}
				else if(ave1 > sensorConfig['machine'][i]['threshold'][0]) { // 緑色が閾値を超えた時
					opeStatus[i] = operating; // 稼働
					tmp1 = operating;
					tmp3 =notOperating;
				}
				else { // 赤緑が閾値を超えなかった時
					opeStatus[i] = notOperating; // 非稼働
					tmp1 =notOperating;
					tmp3 =notOperating;
				}
				console.log(`
			【光センサ】
			シリアル番号　　　：　${sensorConfig['machine'][i]['lig']}
			設定したしきい値左：　${sensorConfig['machine'][i]['threshold'][0]}
			センサ値（平均）左：　${ave1}
			推定結果　　　　左：  ${tmp1}
			--------------------------------
			設定したしきい値右：　${sensorConfig['machine'][i]['threshold'][2]}
			センサ値（平均）右：　${ave3}
			推定結果　　　　右：  ${tmp3}
			`);
			}
			else if(sensorConfig['machine'][i]['ligtype'] == 3) {　//ランプの種類が3色ランプの時()　未完成
				var ave1 = calculateAve(ligValue[i], 'lig1');
				var ave2 = calculateAve(ligValue[i], 'lig2');
				var ave3 = calculateAve(ligValue[i], 'lig3');
				if(ave3 > sensorConfig['machine'][i]['threshold'][2]) { // 赤色が閾値を超えた時
					opeStatus[i] = trouble; // トラブル中
					tmp3 = trouble;
					tmp2 =notOperating;
					tmp1 =notOperating;
				}
				else if(ave2 > sensorConfig['machine'][i]['threshold'][1]) { // 黄色が閾値を超えた時
					opeStatus[i] = PStop; // 稼働
					tmp2 = PStop;
					tmp3 =notOperating;
					tmp1 =notOperating;
				}
				else if(ave1 > sensorConfig['machine'][i]['threshold'][0]) { // 緑色が閾値を超えた時
					opeStatus[i] = operating; // 稼働
					tmp1 = operating;
					tmp2 =notOperating;
					tmp3 =notOperating;
				}
				else { // 赤緑が閾値を超えなかった時
					opeStatus[i] = notOperating; // 非稼働
					tmp3 =notOperating;
					tmp2 =notOperating;
					tmp1 =notOperating;
				}
				console.log(`
			【光センサ】
			シリアル番号　　　：　${sensorConfig['machine'][i]['lig']}
			設定したしきい値左：　${sensorConfig['machine'][i]['threshold'][0]}
			センサ値（平均）左：　${ave1}
			推定結果　　　　左：  ${tmp1}
			--------------------------------
			設定したしきい値中：　${sensorConfig['machine'][i]['threshold'][1]}
			センサ値（平均）中：　${ave2}
			推定結果　　　　中：  ${tmp2}
			--------------------------------
			設定したしきい値右：　${sensorConfig['machine'][i]['threshold'][2]}
			センサ値（平均）右：　${ave3}
			推定結果　　　　右：  ${tmp3}
			`);
			}
			
			
		}
		else { // 光センサの情報が溜まっていない
			opeStatus[i] = 0;
		}
	}
	return opeStatus;
}
function estimateMachineStateChangeLig(opeStatus) {
	var msChange = Array();
	for(var i in sensorConfig['machine']) {
		if(opeStatus[i] != 0) {
			if(machineStatus[i]['operatingStatus'] != opeStatus[i]) {
				msChange.push({ id:sensorConfig['machine'][i]['id'], operatingStatus:opeStatus[i]-1, trouble:0 })
			}
		}
	}
	return msChange;
}
function storeMachineStatusLig(opeStatus) {
	for(var i in sensorConfig['machine']) {
		if(opeStatus[i] != 0) {
			machineStatus[i]['operatingStatus'] = opeStatus[i];
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
