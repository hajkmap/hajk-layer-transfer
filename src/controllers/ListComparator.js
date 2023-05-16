class ListComparator {
  #data;
  constructor() {
    this.#data = { source: null, target: null, decoratedSource: null };
  }

  compareLayers(d, t, key) {
    let dLayers = d[key];
    let tLayers = t[key];

    dLayers.map((item) => {
      let hitCaption = tLayers.find((titem) => item.caption === titem.caption);
      let hitId = tLayers.find((titem) => item.id === titem.id);
      if (hitCaption && !hitId) {
        item.__possible_change = true;
      } else if (!hitCaption) {
        item.__possible_new = true;
      }
    });
  }

  runComparison() {
    if (this.#data.source === null || this.#data.target === null) {
      console.log("Both source and target are needed.");
      return;
    }

    return new Promise((resolve, reject) => {
      let d = { ...this.#data.source };
      let t = this.#data.target;

      Object.keys(d).map((key) => {
        this.compareLayers(d, t, key);
      });

      resolve(d);
    });
  }

  openFile(id, isSourceData) {
    return new Promise((resolve, reject) => {
      window.electron.ipcRenderer.invoke("/file/openDialog").then((result) => {
        if (result) {
          this.#data[isSourceData === true ? "source" : "target"] = result;
          resolve(result);
        } else {
          reject("err");
        }
      });
    });
  }
}

export default ListComparator;
