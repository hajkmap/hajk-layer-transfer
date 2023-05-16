// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

const electronHandler = {
  ipcRenderer: {
    send(channel, args) {
      ipcRenderer.send(channel, args);
    },
    sendSync(channel, args) {
      return ipcRenderer.sendSync(channel, args);
    },
    invoke(channel, args) {
      return ipcRenderer.invoke(channel, args);
    },
    on(channel, cb) {
      let f = (e, data) => {
        cb(data);
      };
      ipcRenderer.on(channel, f);

      return () => {
        ipcRenderer.removeListener(channel, f);
      };
    },
    once(channel, ...args) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld("electron", electronHandler);

export default electronHandler;
