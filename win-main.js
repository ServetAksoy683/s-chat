const { app, BrowserWindow, session, shell, Menu } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

app.setAppUserModelId("com.schat.desktop");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let origin = "";

function handler(req, res) {
  const p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/" || p === "/index.html") {
    fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
      if (err) { res.writeHead(500); res.end("hata"); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end();
  }
}

function tryListen(port) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.once("error", () => resolve(null));
    s.listen(port, "127.0.0.1", () => resolve(s));
  });
}

async function createWindow() {
  // Sabit port: oturum bilgisi (IndexedDB) her açılışta aynı adreste kalsın
  let server = await tryListen(47321);
  if (!server) server = await tryListen(0);
  origin = "http://127.0.0.1:" + server.address().port;

  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    const ok = ["media", "notifications", "fullscreen", "clipboard-sanitized-write"].includes(permission);
    cb(ok && wc.getURL().startsWith(origin));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission) => {
    return ["media", "notifications", "fullscreen"].includes(permission);
  });

  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 500,
    height: 880,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: "#121212",
    icon: path.join(__dirname, "icon.ico"),
    title: "S-Chat",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(origin)) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  win.loadURL(origin + "/index.html");
  win.on("closed", () => { win = null; });
}

app.on("second-instance", () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
