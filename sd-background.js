let debug = false
let screenRunStudioLink = debug ? 'http://localhost:8080/studio' : 'https://screenrun.app/studio'
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
    //lastUrl = null
    //mouseEvents = []
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

let width = 1920;
let height = 1080;

chrome.browserAction.onClicked.addListener(function(tab) {
  width = tab.width
  height = tab.height
  //console.log('tab dimentions=',width,height)
  startScreenDrop(tab.id);
});

function sendToScreenRun(url) {
  lastUrl = url

  downloadScreenDrop(url)
  chrome.tabs.query({url:screenRunStudioLink}, (t) => {
    if (t && t.length > 0) {
      let tabId = t[0].id
      chrome.tabs.update(tabId, {highlighted: true});
      const code = `const evt = new CustomEvent('getScreenRunVideo');document.dispatchEvent(evt);`
      setTimeout(() => chrome.tabs.executeScript(tabId, {code: code}), 2000);
    } else {
      chrome.tabs.create({
        active: true,
        url: screenRunStudioLink
      }, function(tab) {
      })
    }
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

  //chrome.tabs.executeScript(tabid, {file: "inject.js", allFrames: false});
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
    //console.log('recording at width/height',width,height)
    const constraints = {
      audio: false,
      video: true,
      videoConstraints: {
          mandatory: {
              chromeMediaSource: "tab",
              minFrameRate: 30,
              maxFrameRate: 60,
              maxWidth: width,
              maxHeight: height,
              minWidth: width,
              minHeight: height,
          }
      }
  };
    chrome.tabCapture.capture(constraints, (str) => {
      //navigator.mediaDevices.getDisplayMedia({video:{streamId: { exact: streamId}}},(str) => {
      recordingTimer = setInterval(flash,1000)

      stream = str
      if (audioTrack)
        stream.addTrack(audioTrack);
    
      //stream.getVideoTracks()[0].onended = function () {
        stream.getTracks().forEach((t) => {
          t.onended = () => {
            console.log('stream ended')
            startScreenDrop();
          }
      });
      let chunks = [];
      mouseEvents = []
      mediaRecorder = new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,vp9,opus'});
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      }
      mediaRecorder.onstop = function(e) {
        startTime = null
        mediaRecorder = null;
        let blob = new Blob(chunks, { 'type' : 'video/webm' });
        chunks = [];
        let fr = new FileReader();
        fr.onload = (e) => {
          let url = fr.result;
          sendToScreenRun(url)
        }
        fr.readAsDataURL(blob)
      };
      chunks = []
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
