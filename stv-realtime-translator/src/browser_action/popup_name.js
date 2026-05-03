function g(id){
	return document.getElementById(id);
}
function setSetting(id,value){
	var obj = {};
	obj[id] = value ? "true":"false";
	chrome.storage.sync.set(obj, function() {

	});
}
const nameKey = "namedata";
function getSetting(id){
	chrome.storage.sync.get([id], function(result) {
	  	g(id).checked = result[id] == "true";
	});
}
async function getString(id){
    return new Promise((resolve,reject)=>{
        chrome.storage.sync.get([id], function(result) {
            resolve(result[id]);
        });
    });
}
async function setString(id,value){
    return new Promise((resolve,reject)=>{
        chrome.storage.sync.set({[id]: value}, function() {
            resolve();
        });
    });
}
document.addEventListener("DOMContentLoaded",async function() {
    var namedata = await getString(nameKey);
    if(namedata){
        g("name").value = namedata;
    }
	g("save").addEventListener("click", function(){
		var data = g("name").value;
        setString(nameKey,data);
	});
});
