function g(id){
	return document.getElementById(id);
}
function setSetting(id,value){
	var obj = {};
	obj[id] = value ? "true":"false";
	chrome.storage.sync.set(obj, function() {

	});
}
const excludeKey = "excludes";
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

function showMessage(msg){
    const msgBox = g("message");
    msgBox.style.display = "block";
    msgBox.innerText = msg;
    setTimeout(function(){
        msgBox.style.display = "none";
    }, 1200);
}

document.addEventListener("DOMContentLoaded",async function() {
    var excludeData = await getString(excludeKey);
    if(excludeData){
        g("excludes").value = excludeData;
    }
	g("save").addEventListener("click", function(){
		var data = g("excludes").value;
        setString(excludeKey, data);
        showMessage("Đã lưu thành công.");
	});
    g("addCurrent").addEventListener("click", function(){
        chrome.tabs.query({active: true}, function(tabs) {
            var url = tabs[0].url || (tabs[1] ? tabs[1].url : '');
            var domain = new URL(url).hostname;
            var excludeField = g("excludes");
            var currentExcludes = excludeField.value.trim().split('\n').filter(line => line.trim() !== '');
            if (!currentExcludes.includes(domain)) {
                currentExcludes.push(domain);
                excludeField.value = currentExcludes.join('\n');
            }
            setString(excludeKey, excludeField.value);
            showMessage("Đã thêm.");
        });
    });
});
