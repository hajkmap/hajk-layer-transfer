import {
  buildLayerLookup,
  cloneValue,
  decorateSourceOptions,
  getSwitcherOptions,
  isLayersConfig,
  resolveTargetLayerId,
} from "../utils/mapSwitcher";

class MapComparator {
  #data;
  #history;

  constructor() {
    this.#data = {
      source: null,
      target: null,
      sourceLayers: null,
      targetLayers: null,
      layerIdMap: {},
      copiedLayerLookups: {},
    };
    this.#history = [];
  }

  setData(side, data) {
    this.#data[side] = data;
  }

  setOriginal(side, data) {
    this.#data[`${side}Original`] = data;
  }

  getData(side) {
    return this.#data[side];
  }

  getOriginal(side) {
    return this.#data[`${side}Original`] || null;
  }

  getCopyState() {
    return {
      layerIdMap: cloneValue(this.#data.layerIdMap || {}),
      copiedLayerLookups: cloneValue(this.#data.copiedLayerLookups || {}),
    };
  }

  setCopyState(state) {
    this.#data.layerIdMap = cloneValue(state?.layerIdMap || {});
    this.#data.copiedLayerLookups = cloneValue(
      state?.copiedLayerLookups || {}
    );
  }

  pushTargetHistory() {
    if (this.#data.target == null) {
      return false;
    }
    this.#history.push({
      target: cloneValue(this.#data.target),
      copyState: this.getCopyState(),
    });
    return true;
  }

  undoTarget() {
    const entry = this.#history.pop();
    if (!entry) {
      return null;
    }
    const target = cloneValue(entry.target);
    this.#data.target = target;
    this.setCopyState(entry.copyState);
    return target;
  }

  canUndoTarget() {
    return this.#history.length > 0;
  }

  clearTargetHistory() {
    this.#history = [];
  }

  clearFiles() {
    this.#data = {
      source: null,
      target: null,
      sourceLayers: null,
      targetLayers: null,
      layerIdMap: {},
      copiedLayerLookups: {},
    };
    this.clearTargetHistory();
  }

  runComparison() {
    if (!this.hasBothMaps() || !this.hasBothLayersFiles()) {
      return Promise.resolve(null);
    }

    const source = cloneValue(this.#data.source);
    const target = cloneValue(this.#data.target);
    const sourceOptions = getSwitcherOptions(source);
    const targetOptions = getSwitcherOptions(target);

    decorateSourceOptions(sourceOptions, targetOptions, {
      resolveLayerId: (sourceId) =>
        resolveTargetLayerId(
          sourceId,
          this.#data.sourceLayers,
          this.#data.targetLayers,
          this.#data.layerIdMap,
        ),
      sourceLookup: this.getLayerLookup(true),
      targetLookup: this.getLayerLookup(false),
    });
    return Promise.resolve({ source, target });
  }

  openFile(isSourceData) {
    return new Promise((resolve, reject) => {
      window.electron.ipcRenderer.invoke("/file/openDialog").then((result) => {
        if (!result) {
          reject("err");
          return;
        }
        if (!getSwitcherOptions(result)) {
          reject("not-a-map");
          return;
        }
        this.#data[isSourceData === true ? "source" : "target"] = result;
        this.#data[isSourceData === true ? "sourceOriginal" : "targetOriginal"] =
          cloneValue(result);
        if (isSourceData !== true) {
          this.clearTargetHistory();
        }
        resolve(result);
      });
    });
  }

  getLayerLookup(isSourceData) {
    const own = this.#data[isSourceData ? "sourceLayers" : "targetLayers"];
    const fallback = this.#data[isSourceData ? "targetLayers" : "sourceLayers"];
    const lookup = buildLayerLookup(own || fallback);
    if (!isSourceData) {
      Object.assign(lookup, this.#data.copiedLayerLookups || {});
    }
    return lookup;
  }

  getLayersFile(isSourceData) {
    return this.#data[isSourceData ? "sourceLayers" : "targetLayers"];
  }

  getLayerIdMap() {
    return this.#data.layerIdMap || {};
  }

  recordLayerCopy(sourceId, newId, layer) {
    if (sourceId == null || newId == null) {
      return;
    }
    this.#data.layerIdMap[String(sourceId)] = newId;
    this.#data.copiedLayerLookups[String(newId)] = {
      id: newId,
      caption: layer?.caption || layer?.name || "",
      internalLayerName: layer?.internalLayerName || "",
      type: "",
    };
  }

  getLayersSource(isSourceData) {
    const ownKey = isSourceData ? "sourceLayers" : "targetLayers";
    const otherKey = isSourceData ? "targetLayers" : "sourceLayers";
    if (this.#data[ownKey]) {
      return "own";
    }
    if (this.#data[otherKey]) {
      return "other";
    }
    return null;
  }

  hasBothMaps() {
    return Boolean(this.#data.source && this.#data.target);
  }

  hasBothLayersFiles() {
    return Boolean(this.#data.sourceLayers && this.#data.targetLayers);
  }

  canReplaceAllFromSource() {
    return this.hasBothMaps() && this.hasBothLayersFiles();
  }

  openLayersFile(isSourceData) {
    return new Promise((resolve, reject) => {
      window.electron.ipcRenderer.invoke("/file/openDialog").then((result) => {
        if (!result) {
          reject("err");
          return;
        }
        if (!isLayersConfig(result)) {
          reject("not-layers");
          return;
        }
        this.#data[isSourceData === true ? "sourceLayers" : "targetLayers"] =
          result;
        resolve(result);
      });
    });
  }
}

export default MapComparator;
