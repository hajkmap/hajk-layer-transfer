import React, { useEffect, useState } from "react";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import FileOpenIcon from "@mui/icons-material/FileOpen";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import SaveAsIcon from "@mui/icons-material/SaveAs";

import {
  Button,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
} from "@mui/material";
import global from "../models/Global";
import { STATUS_COLORS, getStatusColor } from "../utils/statusColors";

const collectLayerIds = (data) => {
  const ids = new Set();
  Object.keys(data || {}).forEach((key) => {
    (data[key] || []).forEach((layer) => {
      if (layer?.id != null) {
        ids.add(String(layer.id));
      }
    });
  });
  return ids;
};

const layerLabel = (item) =>
  `${item?.caption || item?.internalLayerName || "Unnamed"} (${item?.id})`;

const parseCopyPayload = (payload) => {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    ("items" in payload || "keepSourceId" in payload)
  ) {
    const raw = payload.items;
    return {
      items: Array.isArray(raw) ? raw : raw ? [raw] : [],
      keepSourceId: Boolean(payload.keepSourceId),
    };
  }
  return {
    items: Array.isArray(payload) ? payload : payload ? [payload] : [],
    keepSourceId: false,
  };
};

const LayerList = (props) => {
  const id = props.id;
  const isSourceData = id === "sourceData"; // nice huh....
  const [layerType, setLayerType] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [data, setData] = useState({});
  const [sort, setSort] = useState("date");
  const [desc, setDesc] = useState(true);
  const [filterChanges, setFilterChanges] = useState(false);
  const [textFilter, setTextFilter] = useState("");
  const listComparator = global.listComparator;
  const [initialized, setInitialized] = useState(false);

  const refreshData = (data) => {
    setData(global.getDeepClone(data));

    if (layerType === "") {
      let highest = 0;
      let _layerType = "";
      Object.keys(data).map((key) => {
        const v = data[key].length;
        if (v > highest) {
          highest = v;
          _layerType = key;
        }
      });
      setLayerType(_layerType);
    } else {
      setLayerType(layerType);
    }
  };

  const getPanelName = () => {
    return isSourceData === true ? "source" : "target";
  };

  const rememberTarget = () => {
    const extra =
      global.mapComparator && global.mapComparator.getCopyState
        ? global.mapComparator.getCopyState()
        : {};
    listComparator.pushTargetHistory(extra);
    global.observer.publish("layer-history-changed", {
      canUndo: listComparator.canUndoTarget(),
    });
  };

  const handleUndo = () => {
    const restored = listComparator.undoTarget();
    if (!restored) {
      return;
    }
    if (global.mapComparator && global.mapComparator.setCopyState) {
      global.mapComparator.setCopyState(restored.extra);
    }
    deSelect();
    refreshData(restored.target);
    runComparison();
    global.observer.publish("layer-history-changed", {
      canUndo: listComparator.canUndoTarget(),
    });
  };

  const handleClearFiles = () => {
    setData({});
    setLayerType("");
    setTextFilter("");
    setFilterChanges(false);
    deSelect();
  };

  const handleCopyItem = (payload) => {
    if (Object.keys(data).length === 0) {
      return; // ugly quick fix
    }

    const { items, keepSourceId } = parseCopyPayload(payload);
    if (!items.length || !items[0]) {
      return;
    }

    if (keepSourceId) {
      const existing = collectLayerIds(data);
      const selectedIds = items.map((item) => String(item.id));
      const uniqueSelected = new Set(selectedIds);
      if (uniqueSelected.size !== selectedIds.length) {
        alert(
          "Cannot keep source IDs. The selection contains duplicate IDs."
        );
        return;
      }
      const conflicts = items.filter((item) => existing.has(String(item.id)));
      if (conflicts.length) {
        alert(
          "Cannot keep source IDs. These IDs already exist in the target:\n" +
            conflicts.map(layerLabel).join("\n")
        );
        return;
      }
    }

    rememberTarget();
    items.forEach((item) => {
      let newId = keepSourceId ? item.id : global.getNewLayerId(data);

      let clone = global.getDeepClone(item);
      clone.id = newId;
      Object.keys(clone)
        .filter((key) => {
          return key.indexOf("__") === 0;
        })
        .map((key) => {
          // lets clean up some tmp props
          delete clone[key];
        });

      clone.__is_added = true;

      if (global.mapComparator) {
        global.mapComparator.recordLayerCopy(item.id, newId, item);
      }

      if (global.settings.updateCopiesWithNewDateStamp === true) {
        clone.date = new Date().getTime();
      }

      data[layerType].push(clone);
    });

    listComparator.setData("target", data);
    deSelect();
    refreshData(data);
    runComparison();
  };

  const handleReplaceItem = (obj) => {
    if (Object.keys(data).length === 0 || !obj) {
      return; // ugly quick fix
    }

    const sources = Array.isArray(obj.source)
      ? obj.source
      : obj.source
      ? [obj.source]
      : [];
    const targets = Array.isArray(obj.target)
      ? obj.target
      : obj.target
      ? [obj.target]
      : [];

    if (!sources.length || sources.length !== targets.length) {
      alert(
        "Select the same number of layers in source and target. They are replaced in selection order (each source keeps its paired target id)."
      );
      return;
    }

    rememberTarget();
    sources.forEach((source, i) => {
      const target = targets[i];
      const index = data[layerType].findIndex((item) => item.id === target.id);
      if (index === -1) {
        return;
      }
      let clone = global.getDeepClone(source);
      clone.id = data[layerType][index].id;
      Object.keys(clone)
        .filter((key) => key.indexOf("__") === 0)
        .forEach((key) => {
          delete clone[key];
        });
      clone.__is_replaced = true;
      if (global.settings.updateReplacesWithNewDateStamp === true) {
        clone.date = new Date().getTime();
      }
      if (global.mapComparator) {
        global.mapComparator.recordLayerCopy(source.id, clone.id, source);
      }
      data[layerType][index] = clone;
    });

    deSelect();
    listComparator.setData("target", data);
    refreshData(data);
    runComparison();
  };

  const handleDeleteItem = (itemOrItems) => {
    if (Object.keys(data).length === 0) {
      return; // ugly quick fix
    }

    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    const toDelete = items.filter(Boolean);
    if (!toDelete.length) {
      return;
    }

    rememberTarget();
    toDelete.forEach((item) => {
      const index = data[layerType].findIndex((_item) => _item.id === item.id);
      if (index > -1) {
        data[layerType].splice(index, 1);
      }
    });

    refreshData(data);
    deSelect();
    listComparator.setData("target", data);
    runComparison();
  };

  const deSelect = () => {
    setSelectedIndex(-1);
    setSelectedItem(null);
    setSelectedIds([]);
    global.observer.publish("selection-changed", {
      key: getPanelName(),
      value: null,
    });
  };

  const publishSelection = (ids, list) => {
    const selected = ids
      .map((id) => list.find((item) => String(item.id) === id))
      .filter(Boolean);
    setSelectedIds(ids);
    if (selected.length === 0) {
      setSelectedIndex(-1);
      setSelectedItem(null);
      global.observer.publish("selection-changed", {
        key: getPanelName(),
        value: null,
      });
      return;
    }
    if (selected.length === 1) {
      const only = selected[0];
      const index = list.findIndex((item) => String(item.id) === String(only.id));
      setSelectedIndex(index);
      setSelectedItem(only);
      global.observer.publish("selection-changed", {
        key: getPanelName(),
        value: only,
      });
      return;
    }
    setSelectedIndex(-1);
    setSelectedItem(null);
    global.observer.publish("selection-changed", {
      key: getPanelName(),
      value: selected,
    });
  };

  useEffect(() => {
    if (!props.clearSelectionToken) {
      return;
    }
    deSelect();
  }, [props.clearSelectionToken]);

  useEffect(() => {
    if (!props.clearFilesToken) {
      return;
    }
    handleClearFiles();
  }, [props.clearFilesToken]);

  useEffect(() => {
    global.observer.subscribe("layertype-changed", (data) => {
      if (data.key !== getPanelName()) {
        handleLayerTypeChange(data.value, false);
      }
    });

    // I don't have time to look into the messaging and useEffects any further... not very pretty.
    if (isSourceData === true) {
      global.observer.unsubscribe("refresh-source");
      global.observer.subscribe("refresh-source", refreshData);
      return () => {
        global.observer.unsubscribe("refresh-source");
      };
    } else if (isSourceData === false) {
      global.observer.unsubscribe("copy-to-target");
      global.observer.unsubscribe("replace-in-target");
      global.observer.unsubscribe("delete-in-target");
      global.observer.unsubscribe("refresh-target");
      global.observer.unsubscribe("layer-undo-target");
      global.observer.subscribe("copy-to-target", handleCopyItem);
      global.observer.subscribe("replace-in-target", handleReplaceItem);
      global.observer.subscribe("delete-in-target", handleDeleteItem);
      global.observer.subscribe("refresh-target", refreshData);
      global.observer.subscribe("layer-undo-target", handleUndo);
      return () => {
        global.observer.unsubscribe("copy-to-target");
        global.observer.unsubscribe("replace-in-target");
        global.observer.unsubscribe("delete-in-target");
        global.observer.unsubscribe("refresh-target");
        global.observer.unsubscribe("layer-undo-target");
      };
    }
  }, [data, layerType]);

  useEffect(() => {
    return () => {
      listComparator.setData(isSourceData ? "source" : "target", null);
    };
  }, []);

  const runComparison = () => {
    const result = listComparator.runComparison();
    if (!result || typeof result.then !== "function") {
      return;
    }
    result.then((compared) => {
      if (!compared) {
        return;
      }
      global.observer.publish("refresh-source", compared.source);
      global.observer.publish("refresh-target", compared.target);
    });
  };

  const openFile = () => {
    listComparator
      .openFile(id, isSourceData)
      .then((data) => {
        refreshData(data);
        deSelect();

        // A new source file should always start without compare colors.
        // Re-running compare here would reuse a previous target (even one
        // no longer shown) and immediately paint "different" again.
        if (!isSourceData) {
          global.observer.publish("layer-history-changed", { canUndo: false });
          runComparison();
        }
      })
      .catch((err) => {
        // ignore, no time.......
      });
  };

  const saveFile = () => {
    const cleaned = global.getCleanedData(data);
    global
      .writeJson(cleaned)
      .then(() => {
        const next = global.getDeepClone(cleaned);
        listComparator.setData("target", next);
        listComparator.clearTargetHistory();
        refreshData(next);
        deSelect();
        global.observer.publish("layer-save-success");
        global.observer.publish("layer-history-changed", { canUndo: false });
        listComparator.runComparison().then((compared) => {
          if (compared) {
            global.observer.publish("refresh-source", compared.source);
            global.observer.publish("refresh-target", compared.target);
          }
        });
        alert("Saved JSON");
      })
      .catch(() => {});
  };

  const handleLayerTypeChange = (type, triggeredBySelect = false) => {
    // detach op
    setTimeout(() => {
      setLayerType(type);
      deSelect();
      if (triggeredBySelect === true) {
        // Lets sync the layertype selectboxes.......
        global.observer.publish("layertype-changed", {
          key: getPanelName(),
          value: type,
        });
      }
    }, 25);
  };

  const handleSelectLayer = (event, index, item, visibleList) => {
    const itemId = String(item.id);
    const multi = event.ctrlKey || event.metaKey;

    if (multi) {
      const nextIds = selectedIds.includes(itemId)
        ? selectedIds.filter((id) => id !== itemId)
        : [...selectedIds, itemId];
      publishSelection(nextIds, visibleList);
      return;
    }

    if (selectedIds.length === 1 && selectedIds[0] === itemId) {
      publishSelection([], visibleList);
      return;
    }

    publishSelection([itemId], visibleList);
  };

  const getBgColor = (item) => getStatusColor(item);

  const isTargetDifference = (item) =>
    !isSourceData &&
    item?.__possible_change === true &&
    item?.__is_added !== true &&
    item?.__is_replaced !== true;

  const getItemStyle = (item) => {
    const dashedChange = isTargetDifference(item);
    const bg = dashedChange ? undefined : getBgColor(item);
    return {
      borderBottom: "1px solid rgb(51 50 50)",
      bgcolor: bg,
      outline: dashedChange ? `1px dashed ${STATUS_COLORS.change}` : undefined,
      outlineOffset: dashedChange ? "-1px" : undefined,
      "&.Mui-selected:hover ": {
        backgroundColor: bg,
      },
      "&.Mui-selected ": {
        backgroundColor: bg,
        border: "1px solid grey",
        borderLeft: "4px solid #fff",
        outline: dashedChange ? `1px dashed ${STATUS_COLORS.change}` : undefined,
        outlineOffset: dashedChange ? "-1px" : undefined,
      },
    };
  };

  const getTypeList = () => {
    if (!Object.keys(data)) {
      return [];
    }
    return Object.keys(data).sort((a, b) => {
      return data[b].length - data[a].length;
    });
  };

  const getLayerList = () => {
    if (!data[layerType]) {
      return [];
    }

    let sortMethod = null;

    if (sort === "date") {
      sortMethod = (a, b) => {
        return desc ? b.date - a.date : a.date - b.date;
      };
    } else if (sort === "a-z") {
      sortMethod = (a, b) => {
        return desc
          ? b.caption.localeCompare(a.caption)
          : a.caption.localeCompare(b.caption);
      };
    }

    let a = global.getDeepClone(data[layerType]);

    a.sort(sortMethod);

    if (filterChanges) {
      a = a.filter((item) => {
        return Object.keys(item).join("#").indexOf("#__") > -1;
      });
    }

    let tf = textFilter.trim().toLowerCase();

    if (tf != "") {
      a = a.filter((item) => {
        return (
          item.caption?.toLowerCase().indexOf(tf) > -1 ||
          item.internalLayerName?.toLowerCase().indexOf(tf) > -1
        );
      });
    }

    return a;
  };

  const getDescending = (s) => {
    if (s === sort && desc === false) {
      return "^";
    } else {
      return "\u00A0\u00A0";
    }
  };

  const SortButtons = () => {
    return (
      <div>
        <ToggleButtonGroup
          disabled={!getTypeList().length}
          value={sort}
          exclusive
          onChange={(e, v) => {
            setTimeout(() => {
              setDesc(!desc);
              if (v !== null) {
                setSort(v);
                if (v !== sort) {
                  setDesc(false);
                }
              }
            }, 100);
          }}
        >
          <ToggleButton
            value="a-z"
            size="small"
            style={{ paddingLeft: "1rem", paddingRight: "1rem" }}
          >
            {sort === "a-z" && desc === true ? "z-a" : "a-z"}
          </ToggleButton>
          <ToggleButton
            value="date"
            size="small"
            style={{ paddingLeft: "1rem" }}
          >
            date {getDescending("date")}
          </ToggleButton>
        </ToggleButtonGroup>

        <ToggleButton
          disabled={!getTypeList().length}
          value={filterChanges}
          size="small"
          style={{ marginLeft: "2rem", paddingTop: "5px" }}
          title={"Show only possible additions/changes"}
          onClick={() => {
            setFilterChanges(!filterChanges);
          }}
        >
          {filterChanges ? <FilterAltIcon /> : <FilterAltOffIcon />}
        </ToggleButton>
      </div>
    );
  };

  return (
    <Paper
      sx={{
        p: "1rem",
        flex: 1,
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Grid container spacing={0} sx={{ flexShrink: 0 }}>
        <Grid item xs={6}>
          <Button
            variant="contained"
            size="small"
            onClick={openFile}
            sx={{ mb: "1rem" }}
            startIcon={<FileOpenIcon />}
          >
            {props.openButtonText}
          </Button>
        </Grid>
        <Grid
          item
          xs={6}
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          {isSourceData === false && (
            <Button
              disabled={Object.keys(data).length === 0}
              variant="contained"
              size="small"
              onClick={saveFile}
              sx={{ mb: "1rem" }}
              startIcon={<SaveAsIcon />}
            >
              {"Save to file"}
            </Button>
          )}
        </Grid>
      </Grid>
      <FormControl sx={{ width: "100%", flexShrink: 0 }} size="small">
        <InputLabel id="layer_type">Layer type</InputLabel>
        <Select
          disabled={!getTypeList().length}
          labelId="layer_type"
          id="layer_type"
          label="Layer type"
          value={layerType}
          sx={{ mb: "1rem" }}
          onChange={(event) => handleLayerTypeChange(event.target.value, true)}
        >
          {getTypeList().map((key, index) => {
            return (
              <MenuItem key={`${key}-${index}`} value={key}>
                {key} ({data[key].length})
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
      <FormControl sx={{ width: "100%", flexShrink: 0 }} size="small">
        <Grid container spacing={0}>
          <Grid item xs={6}>
            <SortButtons />
          </Grid>
          <Grid item xs={6}>
            <TextField
              value={textFilter}
              label="Text filter"
              variant="outlined"
              size="small"
              sx={{ width: "100%" }}
              disabled={!getTypeList().length}
              onChange={(e) => {
                setTextFilter(e.target.value);
                deSelect();
              }}
            />
          </Grid>
        </Grid>
      </FormControl>
      <FormControl
        sx={{
          mt: "1rem",
          width: "100%",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
        size="small"
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            border: `1px solid ${global.theme.palette.grey["800"]}`,
            borderRadius: global.theme.shape.borderRadius,
          }}
        >
          <List disabled={!getLayerList().length}>
            {getLayerList().map((item, index) => {
              const isSelected = selectedIds.includes(String(item.id));
              return (
                <ListItemButton
                  sx={getItemStyle(item)}
                  key={`${item.id}-${item.caption}-${index}`}
                  selected={isSelected}
                  onClick={(event) => {
                    handleSelectLayer(event, index, item, getLayerList());
                  }}
                >
                  <ListItemText
                    sx={{ my: 0 }}
                    primary={`${item.caption} ${
                      item.date
                        ? "(" +
                          new Date(parseInt(item.date)).toLocaleDateString() +
                          ")"
                        : ""
                    }`}
                    secondary={item.internalLayerName || null}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </div>
      </FormControl>
    </Paper>
  );
};

export default LayerList;
