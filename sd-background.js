let mouseEvents = []
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (mediaRecorder) {
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
  chrome.tabs.executeScript(tab.id, {file: "inject.js", allFrames: true});
  startScreenDrop();
});

let stream = null;
let mediaRecorder = null;
let startTime = 0;
//let audioStream = null;
let audioTrack = null;


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

async function startScreenDrop() {
  if (mediaRecorder) {
    stream.getTracks().forEach((t) => t.stop());
    mediaRecorder.stop();
    console.log(mouseEvents)
    return;
  }
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
      stream = str
      if (audioTrack)
        stream.addTrack(audioTrack);
    
      stream.getVideoTracks()[0].onended = function () {
        startScreenDrop();
      };
      let chunks = [];
      startTime = Date.now()
      mouseEvents = []
      mediaRecorder = new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'});
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      }
      mediaRecorder.onstop = function(e) {
        chrome.browserAction.setIcon({path: 'icons/off.png'});
        mediaRecorder = null;
        let blob = new Blob(chunks, { 'type' : 'video/webm' });
        chunks = [];
        let fr = new FileReader();
        fr.onload = (e) => {
          let url = fr.result;
          downloadScreenDrop(url);
        }
        fr.readAsDataURL(blob)
      };
      mediaRecorder.start(1000);
      chrome.browserAction.setIcon({path: 'icons/on.png'});
    });
  } catch (epermission) {
    console.log('cancelled',epermission)
    return;
  }
}
