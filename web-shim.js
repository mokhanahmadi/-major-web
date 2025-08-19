// Run Electron-oriented code in a plain browser
window._isWeb = true;
if (typeof window.require !== "function") {
  window.require = function(name){
    if (name === "electron") return {};
    if (name === "fs") return {};
    if (name === "path") return {};
    if (name === "jspdf") return (window.jspdf || {});
    return {};
  };
}
if (!window.module) window.module = {};
