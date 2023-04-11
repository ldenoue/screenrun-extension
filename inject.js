console.log('injected')

//document.body.style.cursor = 'none'

let w = window.innerWidth
let h = window.innerHeight
document.onclick = (evt) => {
  //console.log('click',evt.clientX,evt.clientY)
  try {

    chrome.runtime.sendMessage({type:'click', x: evt.clientX * 100 / w, y: evt.clientY * 100 / h });
  } catch (e) {}
}

/*document.onmousemove = (evt) => {
  try {
    chrome.runtime.sendMessage({type:'move',x: evt.clientX * 100 / w, y: evt.clientY * 100 / h });
  } catch (e) {}
}*/