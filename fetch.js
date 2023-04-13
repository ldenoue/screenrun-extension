document.addEventListener('getScreenRunVideo', function() {
  chrome.runtime.sendMessage({type:'fetch'},(res) => {
    const reply = new CustomEvent("getScreenRunVideoReply", { detail: res});
    document.dispatchEvent(reply);
  });
});
