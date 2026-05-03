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
async function appendNamedata(name){
    var olddata = await getString(nameKey);
    if(olddata){
        olddata += "\n" + name;
    }else{
        olddata = name;
    }
    setString(nameKey,olddata);
}
function parseQuery(){
    var query = location.search.substring(1);
    var vars = query.split("&");
    var result = {};
    for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        result[pair[0]] = decodeURIComponent(pair[1]);
    }
    return result;
}
document.addEventListener("DOMContentLoaded",async function() {
	g("save").addEventListener("click", function(){
		var data = g("name").value;
        appendNamedata(data).then(()=>{
            window.close();
        });
	});
    var query = parseQuery();
    if(query.text){
        g("name").value = query.text+"="+query.trans;
    }
});
