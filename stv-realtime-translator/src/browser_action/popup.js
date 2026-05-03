function g(id){
	return document.getElementById(id);
}
function setSetting(id,value){
	var obj = {};
	obj[id] = value ? "true":"false";
	chrome.storage.sync.set(obj, function() {

	});
}
function getSetting(id){
	chrome.storage.sync.get([id], function(result) {
	  	g(id).checked = result[id] == "true";
	});
}
var checkboxId = [
	"enable",
	"heightauto",
	"widthauto",
	"scaleauto",
	"enableajax",
	"enablescript",
	"strictarial",
	"showbtn"
];
function openNameManager(){
	window.open("name_window.html", "extension_popup", "width=400,height=600,status=no,scrollbars=yes,resizable=yes");
}
function openExcludeManager(){
	window.open("exclude_window.html", "extension_popup", "width=400,height=600,status=no,scrollbars=yes,resizable=yes");
}
document.addEventListener("DOMContentLoaded", function() {
	for(var id of checkboxId){
		g(id).addEventListener("change", function(){
			setSetting(this.id,this.checked);
		});
		getSetting(id);
	}
	g("delaymutation").addEventListener("change", function(){
		var val = parseInt(this.value);
		if(val < 20){
			val = 20;
		}
		chrome.storage.sync.set({"delaymutation":val}, function() {});
	});
	g("delaytrans").addEventListener("change", function(){
		var val = parseInt(this.value);
		if(val < 30){
			val = 30;
		}
		chrome.storage.sync.set({"delaytrans":val}, function() {});
	});
	chrome.storage.sync.get(["delaytrans","delaymutation"], function(result) {
	  	g("delaytrans").value = result["delaytrans"] || 120;
	  	g("delaymutation").value = result["delaymutation"] || 200;
	});
	chrome.storage.sync.get(["server"], function(result) {
	  	g("server").value = result["server"];
	});
	g("server").addEventListener("change", function(){
		chrome.storage.sync.set({server: this.value}, function() {});
	});
	g("openname").addEventListener("click", function(){
		openNameManager();
	});
	g("openexclude").addEventListener("click", function(){
		openExcludeManager();
	});
});
