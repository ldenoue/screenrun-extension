console.log('injected')

//document.body.style.cursor = 'none'

document.onclick = (evt) => {
  //console.log('click',evt.clientX,evt.clientY)
  try {
    chrome.runtime.sendMessage({type:'click',x: evt.clientX,y: evt.clientY});
  } catch (e) {}
}

document.onmousemove = (evt) => {
  //console.log('move',evt.clientX,evt.clientY)
  try {
    chrome.runtime.sendMessage({type:'move',x: evt.clientX,y: evt.clientY});
  } catch (e) {}
}