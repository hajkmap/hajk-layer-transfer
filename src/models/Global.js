import ReactObserver from "react-event-observer";
import ListComparator from "../controllers/ListComparator";
import { v4 as uuidv4 } from "uuid";

class Global {
  constructor() {
    this.settings = null;
    this.observer = null;
    this.listComparator = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      this.observer = new ReactObserver();
      this.readSettings().then((settings) => {
        this.settings = settings;
        this.listComparator = new ListComparator();
        resolve(true);
      });
    });
  }

  findAndReplace(data) {
    this.settings.replaceOnSave.list.forEach((item) => {
      data = data.replace(new RegExp(item.from, "g"), item.to);
    });
    return data;
  }

  getCleanedData(data) {
    // We've created some props that begins with "__".
    // These are only for temporary use and will be removed here.

    let cloneData = this.getDeepClone(data);

    Object.keys(cloneData).map((type) => {
      cloneData[type].forEach((layer, index, arr) => {
        Object.keys(layer)
          .filter((key) => {
            return key.indexOf("__") === 0;
          })
          .map((key) => {
            // lets clean up some tmp props
            delete layer[key];
          });
      });
    });

    let json = JSON.stringify(cloneData, null, 2);

    if (this.settings.replaceOnSave.active) {
      json = this.findAndReplace(json);
    }

    cloneData = JSON.parse(json);

    return cloneData;
  }

  getDeepClone(item) {
    // Create a quick and dirty deep clone
    return JSON.parse(JSON.stringify(item));
  }

  getNewLayerId(data) {
    let ids = [];
    let id = null;

    Object.keys(data).map((key) => {
      // Lets get the ids the fast Old School way ;)
      for (let layer of data[key]) {
        ids.push(layer.id);
      }
    });

    const getId = () => {
      const r = () => {
        if (this.settings.idType === "number") {
          // Should work with old .Net backend
          // Will be tested.
          // Basically we need the highest number + 1

          ids.forEach((el, i, arr) => {
            arr[i] = parseInt(arr[i]);
          });
          const _id = Math.max(...ids) + 1;
          id = "" + _id;
        } else if (this.settings.idType === "uuid") {
          // Should probably work with nodejs backend.
          // Not tested live!
          return uuidv4().split("-")[0];
        }
      };

      let tmp = r();
      let c = 0;

      while (id === null && c < 100) {
        if (ids.indexOf(tmp) === -1) {
          id = tmp;
        } else {
          tmp = r();
        }
        c++;
      }

      return id;
    };
    return getId();
  }

  readSettings() {
    return new Promise((resolve, reject) => {
      window.electron.ipcRenderer.invoke("/settings").then((result) => {
        resolve(result);
      });
    });
  }

  saveJson(data) {
    const cleanData = this.getCleanedData(data);

    return new Promise((resolve, reject) => {
      window.electron.ipcRenderer
        .invoke("/file/saveDialog", cleanData)
        .then((result) => {
          if (result) {
            resolve(result);
          } else {
            reject("err");
          }
        });
    });
  }
}

const global = new Global();

export default global;
