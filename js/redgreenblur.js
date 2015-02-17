var RedGreenBlur = function () {

	var settings = {
		playId: "begin",
		messageId: "message",
		resultId: "result",
		replayId: "replay",
		stages: []
	};
	
	var gameState = {
		mode: "pregame",
		color: null,
		startTime: null,
		endTime: null,
		totalTime: null,
		stage: 0
	};
	
	var dom = {
		playButton: null,
		message: null,
		result: null,
		replayButton: null
	};
	
	function rnd(lo, hi) {
		return Math.floor(Math.random() * (hi - lo + 1)) + lo;
	}
	
	var Colour = function () {
		var rgb = [];
		var colourMax = 256;
		var colourMid = 128;
		var diff = 0;
		var tempDiff = 0;
		var adjustIndex, adjustDelta, i;
		
		for (i = 0; i < 3; i++) {
			rgb.push(rnd(0, colourMax));
			
			/* figure out which rgb attribute will have the biggest possible swing */
			tempDiff = (rgb[i] > colourMid ? rgb[i] : colourMax - rgb[i]); // a number above 128 will adjust down, below 128 will adjust up
			if (tempDiff > diff) {
				diff = tempDiff;
				adjustIndex = i;
			}
		}
		
		function toString() {
			return "rgb(" + rgb.join(",") + ")";
		}
		
		function adjust(delta) {
			if (adjustIndex === undefined) {
				adjustIndex = rnd(0, 2);
			}
			if (adjustDelta === undefined) {
				delta = delta || 1;
				adjustDelta = (rgb[adjustIndex] > colourMid ? delta * -1 : delta);
			}
			
			if (rgb[adjustIndex] + adjustDelta >= 0 && rgb[adjustIndex] + adjustDelta <= colourMax) {
				rgb[adjustIndex] += adjustDelta;
			}
		}
		
		return {
			toString: toString,
			adjust: adjust
		};
	};
	
	var Stage = function (label, adjustInterval, adjustDelta) {
		return {
			label: label,
			adjustInterval: adjustInterval,
			adjustDelta: adjustDelta
		};
	}
	
	var Tracker = (function () {
		function track(action, label) {
			if (ga) {
				if(label) {
					ga('send', 'event', 'RedGreenBlur', action, label);
				} else {
					ga('send', 'event', 'RedGreenBlur', action);
				}
			}
		}
		
		function trackStart() {
			track("start");
		}
		
		function trackWin() {
			track("win", gameState.totalTime.toFixed(3));
		}
		
		function trackLoss() {
			track("loss");
		}
		
		return {
			trackStart: trackStart,
			trackWin: trackWin,
			trackLoss: trackLoss
		}
	}());
	
	var Display = (function () {
		var msgTimer;
		
		function updateArena() {
			if(gameState.colour) {
				dom.arena.style.backgroundColor = gameState.colour.toString();
			}
		}
		
		function message(msg) {
			if (gameState.mode === "game") {
				dom.message.innerHTML = msg;
			} else if (gameState.mode === "postgame") {
				dom.result.innerHTML = msg;
			}
		}
		
		function clearOutput() {
			dom.message.innerHTML = "";
			dom.result.innerHTML = "";
		}
		
		function tempMessage(msg, callback) {
			message(msg);
			msgTimer = setTimeout(function () {
				clearOutput();
				callback();
			}, 2000);
		}
		
		function kill() {
			clearTimeout(msgTimer);
		}
		
		function init() {
			return true;
		}
		
		return {
			updateArena: updateArena,
			message: message,
			tempMessage: tempMessage,
			kill: kill,
			init: init
		}
	}());
	
	var Controller = (function () {
		var arena, phaseTimer;
		
		function switchMode(newMode) { // pregame, game, postgame
			gameState.mode = newMode;
			clearTimeout(phaseTimer);
			dom.arena.className = "mode-" + newMode;
		}
		
		function adjustPhase() {
			if (!gameState.startTime) gameState.startTime = new Date();
			gameState.phase = "adjust";
			gameState.colour.adjust(settings.stages[gameState.stage].adjustDelta);
			Display.updateArena();
			phaseTimer = setTimeout(adjustPhase, settings.stages[gameState.stage].adjustInterval);
		}
		
		function beginStage() {
			gameState.startTime = null;
			gameState.endTime = null;
			gameState.phase = "wait";
			gameState.colour = new Colour();
			Display.updateArena();
			Display.tempMessage(settings.stages[gameState.stage].label, function () {
				phaseTimer = setTimeout(adjustPhase, rnd(500, 3500));
			});
		}
		
		function gameOver() {
			clearTimeout(phaseTimer);
			switchMode("postgame");
			Tracker.trackWin();
			Display.message("Total: " + gameState.totalTime.toFixed(3) + "s");
		}
		
		function handleClick(e) {
			var reactionTime;
			
			if (e.target === dom.playButton || e.target === dom.replayButton) {
				start();
			} else if (gameState.mode === "game" && gameState.phase === "wait") {
				e.cancelBubble = true;
				if (e.stopPropagation) e.stopPropagation();
				
				clearTimeout(phaseTimer);
				Display.kill();
				switchMode("postgame");
				Display.message("Too Soon! Game over.");
				Tracker.trackLoss();
			} else if (gameState.mode === "game" && gameState.phase === "adjust") {
				e.cancelBubble = true;
				if (e.stopPropagation) e.stopPropagation();
				
				clearTimeout(phaseTimer);
				gameState.endTime = new Date();
				reactionTime = (gameState.endTime.getTime() - gameState.startTime.getTime()) / 1000;
				gameState.totalTime += reactionTime;
				
				gameState.phase = "";
				gameState.stage++;
				Display.tempMessage("+" + reactionTime.toFixed(3) + "s (" + gameState.totalTime.toFixed(3) + "s)", (settings.stages[gameState.stage] ? beginStage : gameOver));
			}
		}
		
		function start() {
			gameState.stage = 0;
			gameState.totalTime = 0;
			Tracker.trackStart();
			switchMode("game");
			beginStage();
		}
		
		function init() {
			dom.arena.onclick = handleClick;
			dom.arena.touchstart = handleClick;
			return true;
		}
		
		return {
			start: start,
			init: init
		}
	}());

	var init = function () {
		if (!document.getElementById(settings.playId)) return false;
		if (!document.getElementById(settings.messageId)) return false;
		if (!document.getElementById(settings.resultId)) return false;
		if (!document.getElementById(settings.replayId)) return false;

		dom.arena = document.getElementsByTagName("body")[0];
		dom.playButton = document.getElementById(settings.playId);
		dom.message = document.getElementById(settings.messageId);
		dom.result = document.getElementById(settings.resultId);
		dom.replayButton = document.getElementById(settings.replayId);
		
		settings.stages.push(new Stage("Stage 1/10", 75, 7));
		settings.stages.push(new Stage("Stage 2/10", 75, 6));
		settings.stages.push(new Stage("Stage 3/10", 75, 5));
		settings.stages.push(new Stage("Stage 4/10", 75, 4));
		settings.stages.push(new Stage("Stage 5/10", 75, 3));
		settings.stages.push(new Stage("Stage 6/10", 75, 2));
		settings.stages.push(new Stage("Stage 7/10", 75, 2));
		settings.stages.push(new Stage("Stage 8/10", 75, 1.5));
		settings.stages.push(new Stage("Stage 9/10", 75, 1));
		settings.stages.push(new Stage("Stage 10/10", 75, 0.75));
		
		Display.init();
		Controller.init();
		
		//Controller.start();
	};
	
	return {
		init: init
	};

};