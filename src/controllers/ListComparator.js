const LAYER_COMPARE_SKIP = new Set(["date"]);

const isTempKey = (key) => String(key).indexOf("__") === 0;

const valuesEqual = (a, b) => {
  if (Object.is(a, b)) {
    return true;
  }
  if (a == null || b == null) {
    return a === b;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => valuesEqual(item, b[index]));
  }
  if (typeof a === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (isTempKey(key)) {
        continue;
      }
      if (!valuesEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
};

const layerContentEqual = (source, target) => {
  const keys = new Set([
    ...Object.keys(source || {}),
    ...Object.keys(target || {}),
  ]);
  for (const key of keys) {
    if (isTempKey(key) || LAYER_COMPARE_SKIP.has(key)) {
      continue;
    }
    if (!valuesEqual(source[key], target[key])) {
      return false;
    }
  }
  return true;
};

const findTargetMatch = (item, targetLayers) => {
  const byId = targetLayers.find((target) => target.id === item.id);
  if (byId) {
    return byId;
  }
  if (!item.caption) {
    return undefined;
  }
  return targetLayers.find((target) => target.caption === item.caption);
};

class ListComparator {
  #data;
  #history;

  constructor() {
    this.#data = { source: null, target: null, decoratedSource: null };
    this.#history = [];
  }

  setData(side, data) {
    this.#data[side] = data;
  }

  getData(side) {
    return this.#data[side];
  }

  pushTargetHistory(extra = {}) {
    if (this.#data.target == null) {
      return false;
    }
    this.#history.push({
      target: JSON.parse(JSON.stringify(this.#data.target)),
      extra: JSON.parse(JSON.stringify(extra || {})),
    });
    return true;
  }

  undoTarget() {
    const entry = this.#history.pop();
    if (!entry) {
      return null;
    }
    const target = JSON.parse(JSON.stringify(entry.target));
    this.#data.target = target;
    return {
      target,
      extra: entry.extra || {},
    };
  }

  canUndoTarget() {
    return this.#history.length > 0;
  }

  clearTargetHistory() {
    this.#history = [];
  }

  clearFiles() {
    this.#data = { source: null, target: null, decoratedSource: null };
    this.clearTargetHistory();
  }

  compareLayers(d, t, key) {
    const sourceLayers = d[key];
    const targetLayers = t[key];

    sourceLayers.forEach((item) => {
      const match = findTargetMatch(item, targetLayers);
      if (!match) {
        item.__possible_new = true;
        return;
      }
      if (!layerContentEqual(item, match)) {
        item.__possible_change = true;
        match.__possible_change = true;
      }
    });
  }

  runComparison() {
    if (this.#data.source === null || this.#data.target === null) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const d = JSON.parse(JSON.stringify(this.#data.source));
      const t = JSON.parse(JSON.stringify(this.#data.target));

      Object.keys(d).forEach((key) => {
        if (Array.isArray(d[key]) && Array.isArray(t[key])) {
          this.compareLayers(d, t, key);
        }
      });

      resolve({ source: d, target: t });
    });
  }

  openFile(id, isSourceData) {
    return new Promise((resolve, reject) => {
      window.electron.ipcRenderer.invoke("/file/openDialog").then((result) => {
        if (result) {
          this.#data[isSourceData === true ? "source" : "target"] = result;
          if (isSourceData !== true) {
            this.clearTargetHistory();
          }
          resolve(result);
        } else {
          reject("err");
        }
      });
    });
  }
}

export default ListComparator;
