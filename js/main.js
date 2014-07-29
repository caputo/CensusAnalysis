	dojo.require("esri.tasks.query");
	dojo.require("esri.layers.FeatureLayer");
	dojo.require("esri.map");
	dojo.require("dojox.mobile");
	dojo.require("dojox.mobile.ToolBarButton");
	dojo.require("dojox.mobile.deviceTheme");
	dojo.require("dojo.has");

	var myPosition;
	var concepts;
	var strVariables = [];
	var urlService = "http://tigerweb.geo.census.gov/arcgis/rest/services/tigerWMS_Census2010/MapServer/18";
	var urlServiceGroup = "http://tigerweb.geo.census.gov/arcgis/rest/services/tigerWMS_Census2010/MapServer/16";
	var urlRequest = "http://api.census.gov/data/2010/sf1?get=P0010001&for=block:*&in=state:02+county:290+tract:00100";

	var blocksFL;
	var blocksGroupFL;
	var blnBlock = true;
	var numTotalIds;
	var heatLayer;
	var clientHeight;
	var statusBarHeight;
	var headerGeom;
	var map;
	var oidRange;
	var requestCount;
	var processData;
	var pointsBlocks;
	var heatData;
	var queryTask;
	var objectsIdProcess;
	var extentSearch;
	var extentGraphic;
	var cancel;

	function initMap() {
	//esri.config.defaults.io.proxyUrl = "proxy.jsp";

	var supportsOrientationChange = "onorientationchange" in window,
	orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";
	window.addEventListener(orientationEvent, function () {
		orientationChanged();
	}, false);

	map = new esri.Map("map", {
		basemap: "streets",
		center: [-118.696, 34.111],
		zoom: 7
	});

	addjustMapHeight();
	blocksFL = new esri.layers.FeatureLayer(urlService);
	blocksGroupFL = new esri.layers.FeatureLayer(urlServiceGroup);

	map.addLayer(blocksFL);
	map.addLayer(blocksGroupFL);


	dojo.connect(map, "onExtentChange", function(extent) {
		if(map.getScale() < blocksFL.minScale){
			blnBlock = true;
			$('#btnSelectBlock').addClass('active');
			$('#btnSelectBlockGroup').removeClass('active');
		}else {
			blnBlock = false;
			$('#btnSelectBlockGroup').addClass('active');
			$('#btnSelectBlock').removeClass('active');
		}
	});



	heatLayer = new HeatmapLayer({
		config: {
			"useLocalMaximum": true,
			"radius": 80,
			"gradient": {
				0.45: "rgb(000,000,255)",
				0.55: "rgb(000,255,255)",
				0.65: "rgb(000,255,000)",
				0.95: "rgb(255,255,000)",
				1.00: "rgb(255,000,000)"
			}
		},
		"map": map,
		"domNodeId": "heatLayer",
		"opacity": 0.85
	});
	map.addLayer(heatLayer);
	dojo.connect(map, "onLoad", mapLoadHandler);

}

function mapLoadHandler(map) {
	addjustMapHeight();
	loadMapViewTransition();
}

function orientationChanged() {
	dojo.byId("map").style.height = (window.innerHeight + statusBarHeight) + "px";
	addjustMapHeight();

}

function addjustMapHeight() {
	dojo.byId("map").style.height = (window.innerHeight -40 ) + "px";
	$('#divTool').css('height', (window.innerHeight) + "px");
	if (map) {
		map.resize();
		map.reposition();
	}
}

function loadMapViewTransition() {
	dojo.connect(dijit.byId('mapView'), 'onAfterTransitionIn', null, function (moveTo, dir, transition, context, method) {
		map.reposition();
	});
}


function init(){
	statusBarHeight = 40;
	clientHeight = document.body.clientHeight;

	initMap();

	loadVariables();

	$('#btnAdd').click(function(){
		addVariable();
	});

	$('#btnCreateMap').click(function(){
		createMap(); 
	});

	$('#btnMyPosition').click(function(){
		zoomMyLocation();
	});

	$('#btnClearMap').click(function(){
		heatLayer.clear();
	});
	$('#btnSelectBlock').click(function(){
		$('#btnSelectBlock').addClass('active');
		changeBounds();
	});
	$('#btnSelectBlockGroup').click(function(){
		$('#btnSelectBlockGroup').addClass('active');
		changeBounds();
	});
	$('#btnShowBlocks').click(function(){
		blocksFL.setVisibility(!blocksFL.visible);
		blocksGroupFL.setVisibility(!blocksGroupFL.visible);
	});
	$('#btnCancel').click(function(){
		cancelOperation();
	});
}

function cancelOperation(){
	cancel = true;
	$('#progress').hide();
	
}

function changeBounds(){
	if($('#btnSelectBlock').hasClass('active')){
		blnBlock=true;
	}else{
		blnBlock = false;		
	}
}


function createMap(){

	pointsBlocks = [];
	heatData = new Array();
	cancel = false;
	var query = new esri.tasks.Query();
	queryTask = new esri.tasks.QueryTask(blnBlock?urlService:urlServiceGroup);
	extentSearch = map.extent;
	var sfs = fillSymbol = new esri.symbol.SimpleFillSymbol(
		esri.symbol.SimpleFillSymbol.NONE,
		new esri.symbol.SimpleLineSymbol(
			esri.symbol.SimpleLineSymbol.STYLE_DASH_DOT,
			new dojo.Color([ 255, 0, 0 ]), 2),
		new dojo.Color([ 0, 0, 0, 0.1 ]));


	if(extentGraphic != null){
		map.graphics.remove(extentGraphic);
	}
	extentGraphic = new esri.Graphic(extentSearch,sfs,null);
	map.graphics.add(extentGraphic);
	query.geometry = extentSearch;
	query.outFields = ["*"];
	query.returnGeometry = true;	

	$('#progress').show();
	$('#progressbar').css('width','0%');
	processData = 0 ;

	queryTask.executeForIds(query, function(objectsId) {		
		requestCount = objectsId.length;
		numTotalIds - objectsId.length;
		objectsIdProcess = objectsId;
		processDataOID();	
		oidRange=0;
	},queryFault);
}

function processDataOID(){	
	if(cancel)return;

	if(oidRange>=numTotalIds)return;
	requestCount++;
	var oids = objectsIdProcess.length > 900?objectsIdProcess.splice(0,900):objectsIdProcess;
	oidRange+=900;
	var queryObjectIds = new esri.tasks.Query();
	queryObjectIds.objectIds = oids;
	queryObjectIds.returnGeometry = true;
	queryObjectIds.geometry = extentSearch;
	queryObjectIds.outFields = ["*"];
	queryTask.execute(queryObjectIds,processFeatureSet,queryFault);
}
function queryFault(error){
	alert("Error retrieving geographic data: " + error);
	$('#progress').hide();
}

function updateProgress(){
	processData++;				
	var per = (processData * 100) / requestCount;				
	$('#progressbar').css('width',per + '%');
	if(processData>=requestCount){
		heatLayer.setData(heatData);
		$('#progress').hide();
	}
}
function processFeatureSet(featureSet){
	updateProgress();
	for(var i=0; i<featureSet.features.length;i++){
		if(cancel)return;
		
		var blockId = featureSet.features[i].attributes[blnBlock?"BLOCK":"BLKGRP"];
		var countyId = featureSet.features[i].attributes["COUNTY"];
		var stateId = featureSet.features[i].attributes["STATE"];
		var tractId = featureSet.features[i].attributes["TRACT"];

		pointsBlocks[blockId] = featureSet.features[i].geometry.getExtent().getCenter();

		var strUrl = 'http://api.census.gov/data/2010/sf1?get='+strVariables.toString()
		+'&for='+(blnBlock?'block':'block+group')+':'+blockId+'&in=state:'+stateId
		+'+county:'+countyId+'+tract:'+tractId+'&key=3ad498d9722fa4f7ab6fff12ccc0a4456245b436';

		$.ajax({
			url: strUrl,
			type: 'GET',
			error:function(error){				
				updateProgress();
			},
			success: sucessCensusData
		});

	}

	processDataOID();
}

function sucessCensusData(data){

	if(cancel)return;
	var fields = data[0];
	var values = data[1];	
	var countTotal = 0.0;
	var blockResultId;

	for(var f=0;f<strVariables.length;f++){
		for(var r = 0 ; r<fields.length;r++){
			if(fields[r].toLowerCase() === strVariables[f].toLowerCase() ){
				countTotal += (values[r]?Number(values[r]):0.0);
				break;
			}
		}
	}

	for(var f=0;f<fields.length;f++){
		if(fields[f].toLowerCase() == (blnBlock?"block":"block group")){
			blockResultId = values[f];
			break;
		}
	}

	var geom = pointsBlocks[blockResultId];
	if(geom){
		var data = {
			attributes: {
				count:countTotal
			},
			geometry:geom
		};
		heatData.push(data);
	}


	updateProgress();
}

function zoomMyLocation(){
	if (navigator.geolocation){ 
		navigator.geolocation.getCurrentPosition(function(pos){
			var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(
				pos.coords.longitude, pos.coords.latitude));

			var symbol = new esri.symbol.SimpleMarkerSymbol(
				esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12,
				new esri.symbol.SimpleLineSymbol(
					esri.symbol.SimpleLineSymbol.STYLE_SOLID,
					new dojo.Color([ 255, 105, 30, 0.5 ]), 8),
				new dojo.Color([ 255, 105, 30, 0.9 ]));
			var graphic = new esri.Graphic(pt, symbol);
			if(myPosition != null){
				map.graphics.remove(myPosition);
			}
			myPosition = graphic;
			map.graphics.add(graphic);
			map.centerAndZoom(pt, 12);
		}
		);
	}
}
function addVariable(){
	var concept = concepts[$('#cboConcept').val()];
	var variableAdd = concept.variables[$('#cboVariable').val()];

	for(var i=0;i<strVariables.length;i++){
		if(strVariables[i].toLowerCase() === variableAdd.value.toLowerCase()){
			alert('Variable already added');
			return;
		}
	}

	strVariables.push(variableAdd.value);
	$('#listVariables').append('<span id="sp'+strVariables.length+'" class="label label-inverse"><button data-value="'+strVariables.length+'" type="button" class="close remove_var">x</button><p>'+variableAdd.name+'<p></span>');
	$('.remove_var').click(function(){
		var id = $(this).attr('data-value');
		strVariables.splice(id, 1);
		$('#sp'+id).remove();
	});
}

function loadVariables(){
	concepts = new Array();
	if (window.XMLHttpRequest)
	{// code for IE7+, Firefox, Chrome, Opera, Safari
		xmlhttp=new XMLHttpRequest();
	}
	else
	{// code for IE6, IE5
		xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
	}
	xmlhttp.open("GET","sf1.xml",false);
	xmlhttp.send();
	xmlDoc=xmlhttp.responseXML;

	for(var i=0;i<xmlDoc.getElementsByTagName('concept').length;i++){
		var name = xmlDoc.getElementsByTagName('concept')[i].attributes[0].value;
		var concept = {
			name:name,
			variables:new Array()
		}
		for( var j=0; j< xmlDoc.getElementsByTagName('concept')[i].getElementsByTagName('variable').length;j++){
			var variableXML = xmlDoc.getElementsByTagName('concept')[i].getElementsByTagName('variable')[j];
			var variable = {
				value:variableXML.attributes[0].nodeValue,
				name:variableXML.textContent
			}
			concept.variables.push(variable);
		}
		concepts.push(concept);
	}
	$('#cboConcept').empty();
	for(var i=0; i<concepts.length;i++){
		$('#cboConcept').append('<option value="'+i+'">'+concepts[i].name+'</option>');		
	}
	$('#cboConcept').change(function(){
		var id = $('#cboConcept').val();
		var myCon = concepts[id];
		$('#cboVariable').empty();
		for(var j=0;j<myCon.variables.length;j++){
			$('#cboVariable').append('<option value="'+j+'">'+myCon.variables[j].name+'</option>')
		}
	}).change();

}


dojo.addOnLoad(init);