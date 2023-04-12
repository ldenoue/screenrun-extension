let debug = true
let mouseEvents = []
let recordingTimer = null
let stream = null;
let mediaRecorder = null;
let startTime = null;
//let audioStream = null;
let audioTrack = null;
let lastUrl = null

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'fetch') {
    sendResponse({lastUrl,mouseEvents})
    lastUrl = null
    mouseEvents = []
  }
  else if (startTime) {
    let event = request
    event.ts = Date.now() - startTime
    mouseEvents.push(event)
  }
  sendResponse();
});

chrome.runtime.onInstalled.addListener((details) => {
  //console.log(details);
  if (details.reason.search(/install/g) === -1) {
      return
  }
  chrome.storage.local.set({keepLastOnly:true});
  chrome.tabs.create({
      url: chrome.extension.getURL("welcome.html"),
      active: true
  })
})

chrome.browserAction.onClicked.addListener(function(tab) {
  //console.log(tab)
  /*chrome.tabCapture.getMediaStreamId({consumerTabId: tab.id}, (streamId) => {
    startScreenDrop(streamId);
  })*/
  startScreenDrop(tab.id);
});

function sendToScreenRun(url) {
  lastUrl = url

  chrome.tabs.create({
    active: true,
    url: debug ? 'http://localhost:8080/studio' : 'https://screenrun.app/studio'
  }, function(tab) {
    //chrome.tabs.executeScript(tab.id, {file: "fetch.js", allFrames: false})
  })
}

function downloadScreenDrop(url) {
  chrome.storage.local.get('keepLastOnly',(res) => {
    let filename = '';
    if (res.keepLastOnly)
      filename = 'screenrun.webm';
    else
      filename = 'screenrun-' + Date.now() + '.webm';
    chrome.downloads.download({
      url: url,
      filename: filename,
      conflictAction: res.keepLastOnly?'overwrite':'uniquify',
    }, (downloadId) => {
      //chrome.storage.local.set({downloadId});
    });
  });
}

let iconOn = false
function flash() {
  iconOn = !iconOn
  chrome.browserAction.setIcon({path: iconOn ? 'icons/on.png' : 'icons/off.png'});
}
async function startScreenDrop(tabid) {
  if (mediaRecorder) {
    clearInterval(recordingTimer)
    chrome.browserAction.setIcon({path: 'icons/off.png'});
    stream.getTracks().forEach((t) => t.stop());
    mediaRecorder.stop();
    return;
  }

  chrome.tabs.executeScript(tabid, {file: "inject.js", allFrames: false});
  try {
    let audioStream = await navigator.mediaDevices.getUserMedia({audio:true});
    audioTrack = audioStream.getAudioTracks()[0];
  } catch (eaudiopermission) {
    console.log('no audio',eaudiopermission);
  }

  try {
    //stream = await navigator.mediaDevices.getDisplayMedia({video:{preferCurrentTab:true}});
    /*stream = await navigator.mediaDevices.getUserMedia({
      //audio: true,
      video: {
          mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId
          }
      }
    })*/
    chrome.tabCapture.capture({video:true},(str) => {
      recordingTimer = setInterval(flash,1000)

      stream = str
      if (audioTrack)
        stream.addTrack(audioTrack);
    
      stream.getVideoTracks()[0].onended = function () {
        startScreenDrop();
      };
      let chunks = [];
      mouseEvents = []
      mediaRecorder = new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'});
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      }
      mediaRecorder.onstop = function(e) {
        startTime = null
        //chrome.browserAction.setIcon({path: 'icons/off.png'});
        mediaRecorder = null;
        let blob = new Blob(chunks, { 'type' : 'video/webm' });
        chunks = [];
        let fr = new FileReader();
        fr.onload = (e) => {
          let url = fr.result;
          //downloadScreenDrop(url);
          sendToScreenRun(url)
        }
        fr.readAsDataURL(blob)
      };
      mediaRecorder.start(1000);
      startTime = Date.now()
      //chrome.browserAction.setIcon({path: 'icons/on.png'});
    });
  } catch (epermission) {
    console.log('cancelled',epermission)
    clearInterval(recordingTimer)
    chrome.browserAction.setIcon({path: 'icons/off.png'});
    return;
  }
}
