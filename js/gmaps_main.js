var concepts;
var strVariables = [];
var urlService = "http://tigerweb.geo.census.gov/arcgis/rest/services/tigerWMS_Census2010/MapServer/18";
var urlServiceGroup = "http://tigerweb.geo.census.gov/arcgis/rest/services/tigerWMS_Census2010/MapServer/16";
var urlRequest = "http://api.census.gov/data/2010/sf1?";
var urlSearch;
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
var heatmap;
var myLoc;
var heatLayer;
var listRequests;	

$(document).ready(init);

function init(){
	createNav();
	var mapOptions = {
		center: new google.maps.LatLng(37.186579,-122.13501),
		zoom: 8,		
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		zoomControlOptions: {style:google.maps.ZoomControlStyle.SMALL}
	};

	map = new google.maps.Map(document.getElementById("map"),
		mapOptions);

	resizeWin();
	loadVariables();

	$('#btnAdd').click(function(){
		addVariable();
	});

	$('#btnCreateMap').click(function(){
		if(!$('#btnCreateMap').hasClass('disabled'))
			createMap(); 
	});

	$('#btnMyPosition').click(function(){
		zoomMyLocation();
	});

	$('#btnClearMap').click(function(){
		if(heatmap)
			heatmap.setMap(null);
	});
	$('#btnSelectBlock').click(function(){
		$('#btnSelectBlock').addClass('active');
		$('#btnSelectBlockGroup').removeClass('active');
		changeBounds();

	});
	$('#btnSelectBlockGroup').click(function(){
		$('#btnSelectBlockGroup').addClass('active');
		$('#btnSelectBlock').removeClass('active');
		changeBounds();
	});

	$('#btnCancel').click(function(){
		cancelOperation();
	});

	$(window).bind('resize', function() {
		resizeWin();
	});
	$(window).bind('orientationchange', function() {
		resizeWin();
	});

}
function createNav() {
	var sticky_navigation_offset_top = $('#navbar').offset().top;

	var sticky_navigation = function() {
		var scroll_top = $(window).scrollTop();

		if (scroll_top > sticky_navigation_offset_top) {
			$('#navbar').css({
				'position' : 'fixed',
				'top' : 0,
				'left' : 0
			});
		}
	};

	sticky_navigation();

	$(window).scroll(function() {
		sticky_navigation();
	});

	$('a[href="#"]').click(function(event) {
		event.preventDefault();
	});

}

function resizeWin(){
	var heightWind =  (window.innerHeight)  - Number($('#navbar').css('height').replace('px',''));
	$('#map').css('height', heightWind + "px");
	$('#myModal').css('max-height', (heightWind-20) + "px");
	$('#divTool').css('height', (heightWind - 15) + "px");	
}

function cancelOperation(){
	for(var i=0; i<listRequests.length;i++){
		try{
			listRequests[i].abort();
		}catch(error){

		}
	}

	cancel = true;
	$('#progress').hide();
	$('#toolOptions').show();
}

function changeBounds(){
	if($('#btnSelectBlock').hasClass('active')){
		blnBlock=true;
	}else{
		blnBlock = false;		
	}
}


function zoomMyLocation(){
	if(!myLoc){
		var myloc = new google.maps.Marker({
			clickable: false,
			icon: new google.maps.MarkerImage('//maps.gstatic.com/mapfiles/mobile/mobileimgs2.png',
				new google.maps.Size(22,22),
				new google.maps.Point(0,18),
				new google.maps.Point(11,11)),
			shadow: null,
			zIndex: 999,
			map: map
		});
	}

	if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function(pos) {
		var me = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
		myloc.setPosition(me);
		map.setZoom(17);
		map.panTo(myloc.position);
	}, function(error) {
		
		alert('Error on requesting your location!');
	});
}

function createMap(){

	pointsBlocks = new Array();
	listRequests = new Array();
	heatData = new Array();	
	cancel = false;

	$('#progress').show();
	$('#toolOptions').hide();
	$('#progressbar').css('width','0%');
	processData = 0 ;


	if(heatmap){
		heatmap.setMap(null);	
	}

	urlSearch = blnBlock?urlService:urlServiceGroup; 

	var northEast = map.getBounds().getNorthEast();
	var southWest = map.getBounds().getSouthWest();
	
	extentSearch = 'geometry='+ northEast.lng() + ',' + northEast.lat() +
	','+ southWest.lng() + ',' + southWest.lat() +'&inSR=4326&geometryType=esriGeometryEnvelope';
	
	var queryIds = urlSearch+'/query?'
	+ extentSearch + '&'
	+ 'returnIdsOnly=true&f=json';

	listRequests.push($.ajax({
		url: queryIds,
		type: 'GET',		
		error:queryFault,
		success: function(returnData) {
			var data = JSON.parse(returnData);
			requestCount = data.objectIds.length;			
			numTotalIds  = data.objectIds.length;			
			objectsIdProcess = data.objectIds;			
			processDataOID();		
		}
	}));
}

function processDataOID(){	
	

	for(var count=0;count<numTotalIds;count+=100){					
		if(cancel)return;
		if(objectsIdProcess.length > 100){
			queryOids(objectsIdProcess.splice(0,100));			
		}else{
			queryOids(objectsIdProcess);
			break;
		}		
	}

}
function queryOids(oids){
	
	
	var querystr = urlSearch+'/query?';
	querystr+='objectIds='+oids.toString()+'&'+extentSearch+'&returnGeometry=false&outFields=*&f=json';
	
	listRequests.push($.ajax({
		url: querystr,
		type: 'GET',		
		error:queryFault,
		success: function(returnData) {
			var data = JSON.parse(returnData);
			processFeatureSet(data.features);
		}
	}));
}

function queryFault(error){
	if(!cancel){
		alert("Error requesting geographic data: " + error);
		cancelOperation();
	}
}


function updateProgress(){
	processData++;				
	var per = (processData * 100) / requestCount;				
	$('#progressbar').css('width',per + '%');
	if(processData>=requestCount){
		var pointArray = new google.maps.MVCArray(heatData);
		heatmap = new google.maps.visualization.HeatmapLayer(
		{			
			data:pointArray,
			radius: 70,
			opacity: 0.5
		});
		
		heatmap.setMap(map);
		
		$('#progress').hide();
		$('#toolOptions').show();
	}
}

function processFeatureSet(featureSet){
	//updateProgress();	
	
	for(var i=0; i<featureSet.length;i++){
		if(cancel)return;

		var blockId = featureSet[i].attributes[blnBlock?"BLOCK":"BLKGRP"];
		var countyId = featureSet[i].attributes["COUNTY"];
		var stateId = featureSet[i].attributes["STATE"];
		var tractId = featureSet[i].attributes["TRACT"];
		var centLat = featureSet[i].attributes["INTPTLAT"];
		var centLon = featureSet[i].attributes["INTPTLON"];
		
		var location = new google.maps.LatLng(centLat.replace('+',''),centLon);
		var myLocData = {
			id:blockId,location:location
		};
		pointsBlocks.push(myLocData);

		var strUrl = urlRequest +  'get='+strVariables.toString()
		+'&for='+(blnBlock?'block':'block+group')+':'+blockId+'&in=state:'+stateId
		+'+county:'+countyId+'+tract:'+tractId+'&key=3ad498d9722fa4f7ab6fff12ccc0a4456245b436';

		listRequests.push($.ajax({
			url: strUrl,
			type: 'GET',
			error:function(error){				
				if(!cancel){
					alert('Error requesting census data! \n' +erro );
					cancelOperation();
				}
			},
			success: sucessCensusData
		}));
	}
//processDataOID();
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
		if(fields[f].toLowerCase() === (blnBlock?"block":"block group")){
			blockResultId = values[f];
			break;
		}
	}
	var geom;
	for(var i =0;i<pointsBlocks.length;i++){
		if(pointsBlocks[i].id === blockResultId){
			geom = pointsBlocks[i].location;
			break;
		}
	}

	
	var dataLoc = {location: geom, weight: countTotal};	
	heatData.push(dataLoc);
	updateProgress();
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
	$('#btnCreateMap').removeClass('disabled');
	$('#listVariables').append('<span id="sp'+variableAdd.value.toLowerCase()+'" class="label label-default"><button data-value="'+variableAdd.value.toLowerCase()+'" type="button" class="close remove_var"><i class="icon-white icon-remove"></i></button><p>'+variableAdd.name+'<p></span>');
	$('.remove_var').click(function(){
		var id = $(this).attr('data-value');
		for(var i=0;i<strVariables.length;i++){
			if(strVariables[i].toLowerCase() === id){
				strVariables.splice(id, 1);
				$('#sp'+id).remove();
				break;
			}
		}
		if(strVariables.length === 0)
			$('#btnCreateMap').addClass('disabled');
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


