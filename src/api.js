const { ipcMain, dialog } = require("electron");
const fs = require("fs");
const global = require("./models/Global");

const readFile = (filePath) => {
  let data = fs.readFileSync(filePath, "utf8");
  return filePath.endsWith(".json") ? JSON.parse(data) : data;
};

const saveFile = (filePath, sData) => {
  fs.writeFileSync(filePath, sData, {
    encoding: "utf8",
    flag: "w",
  });
};

ipcMain.handle("/file/openDialog", async (event, data) => {
  const result = await dialog.showOpenDialog({
    title: "Open file",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!result.canceled) {
    return readFile(result.filePaths[0]);
  }
  return null;
});

ipcMain.handle("/file/saveDialog", async (event, data) => {
  const result = await dialog.showSaveDialog({
    title: "Save file",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!result.canceled) {
    // For some reason I need to stringify here in the node api,
    // If stringify is made in Global.js (Browser) the output becomes wrong.
    // I have not investigated further. But good to know.

    saveFile(result.filePath, JSON.stringify(data, null, 2));
    return true;
  }
  return null;
});

ipcMain.handle("/settings", async (event) => {
  return readFile("app.config.json");
});
