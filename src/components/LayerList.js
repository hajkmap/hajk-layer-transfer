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
import { SettingsSystemDaydreamTwoTone } from "@mui/icons-material";

const LayerList = (props) => {
  const id = props.id;
  const isSourceData = id === "sourceData"; // nice huh....
  const [layerType, setLayerType] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedItem, setSelectedItem] = useState(null);
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
    // nice huh.....
    return isSourceData === true ? "source" : "target";
  };

  const handleCopyItem = (item) => {
    if (Object.keys(data).length === 0) {
      return; // ugly quick fix
    }

    let newId = global.getNewLayerId(data);

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

    if (global.settings.updateCopiesWithNewDateStamp === true) {
      clone.date = new Date().getTime();
    }

    data[layerType].push(clone);
    deSelect();
    refreshData(data);
  };

  const handleReplaceItem = (obj) => {
    if (Object.keys(data).length === 0) {
      return; // ugly quick fix
    }
    let index = data[layerType].findIndex((item) => item.id === obj.target.id);
    if (index > -1) {
      let clone = global.getDeepClone(obj.source);
      clone.id = data[layerType][index].id; // keep original ID
      clone.__is_replaced = true;
      if (global.settings.updateReplacesWithNewDateStamp === true) {
        clone.date = new Date().getTime();
      }
      data[layerType][index] = clone;
    }
    deSelect();
    refreshData(data);
  };

  const handleDeleteItem = (item) => {
    if (Object.keys(data).length === 0) {
      return; // ugly quick fix
    }

    let index = data[layerType].findIndex((_item) => _item.id === item.id);

    if (index > -1) {
      data[layerType].splice(index, 1);
      refreshData(data);
      setSelectedIndex(-1);
      setSelectedItem(null);
      global.observer.publish("selection-changed", {
        key: "target",
        value: null,
      });
    }
  };

  const deSelect = () => {
    setSelectedIndex(-1);
    setSelectedItem(null);
    global.observer.publish("selection-changed", {
      key: getPanelName(),
      value: null,
    });
  };

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
      global.observer.subscribe("copy-to-target", handleCopyItem);
      global.observer.subscribe("replace-in-target", handleReplaceItem);
      global.observer.subscribe("delete-in-target", handleDeleteItem);
      return () => {
        global.observer.unsubscribe("copy-to-target");
        global.observer.unsubscribe("replace-in-target");
        global.observer.unsubscribe("delete-in-target");
      };
    }
  }, [data, layerType]);

  const runComparison = () => {
    listComparator.runComparison().then((data) => {
      if (isSourceData) {
        refreshData(data);
      } else {
        global.observer.publish("refresh-source", data);
      }
    });
  };

  const openFile = () => {
    listComparator
      .openFile(id, isSourceData)
      .then((data) => {
        // we'll refresh UI with uncompared values first
        refreshData(data);

        // then we'll trigger a compare
        runComparison();
      })
      .catch((err) => {
        // ignore, no time.......
      });
  };

  const saveFile = () => {
    global
      .saveJson(data)
      .then((_data) => {
        alert("Saved JSON");
      })
      .catch((err) => {
        // ignore, no time.......
      });
  };

  const handleLayerTypeChange = (type, triggeredBySelect = false) => {
    // detach op
    setTimeout(() => {
      setLayerType(type);
      setSelectedIndex(-1);
      setSelectedItem(null);
      global.observer.publish("selection-changed", {
        key: getPanelName(),
        value: null,
      });
      if (triggeredBySelect === true) {
        // Lets sync the layertype selectboxes.......
        global.observer.publish("layertype-changed", {
          key: getPanelName(),
          value: type,
        });
      }
    }, 25);
  };

  const handleSelectLayer = (layerType, index, item) => {
    const newIndex = selectedIndex === index ? -1 : index;
    setSelectedIndex(newIndex);

    // detach op
    setTimeout(() => {
      global.observer.publish("selection-changed", {
        key: getPanelName(),
        value: newIndex > -1 ? item : null,
      });

      setSelectedItem(newIndex ? item : null);
    }, 100);
  };

  const getBgColor = (item) => {
    if (item.__is_replaced === true) {
      return "darkgreen";
    } else if (item.__is_added === true) {
      return "green";
    } else if (item.__possible_change === true) {
      return "#664d69";
    } else if (item.__possible_new === true) {
      return "#015b5b";
    }
  };

  const getItemStyle = (item) => {
    return {
      borderBottom: "1px solid rgb(51 50 50)",
      bgcolor: getBgColor(item),
      "&.Mui-selected:hover ": {
        backgroundColor: getBgColor(item),
      },
      "&.Mui-selected ": {
        backgroundColor: getBgColor(item),
        border: "1px solid grey",
        borderLeft: "4px solid #fff",
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
    <Paper sx={{ p: "1rem" }}>
      <Grid container spacing={0}>
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
      <FormControl sx={{ width: "100%" }} size="small">
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
      <FormControl sx={{ width: "100%" }} size="small">
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
      <FormControl sx={{ mt: "1rem", width: "100%" }} size="small">
        <div
          style={{
            height: "350px",
            overflowY: "auto",
            border: `1px solid ${global.theme.palette.grey["800"]}`,
            borderRadius: global.theme.shape.borderRadius,
          }}
        >
          <List disabled={!getLayerList().length}>
            {getLayerList().map((item, index) => {
              return (
                <ListItemButton
                  sx={getItemStyle(item)}
                  key={`${item.caption}-${index}`}
                  selected={selectedIndex === index}
                  onClick={(event) => {
                    handleSelectLayer(layerType, index, item);
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
