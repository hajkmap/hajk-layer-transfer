import {
  AppBar,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  FormControlLabel,
  Grid,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CloseIcon from "@mui/icons-material/Close";
import DifferenceIcon from "@mui/icons-material/Difference";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import UndoIcon from "@mui/icons-material/Undo";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import global from "../models/Global";
import MapTree from "../components/MapTree";
import SelectionCompare from "./SelectionCompare";
import { getSelectionLabel, stripTempProps } from "../utils/mapSwitcher";
import StatusLegend from "../components/StatusLegend";

const MapTransferView = () => {
  const [targetSelection, setTargetSelection] = useState(null);
  const [sourceSelection, setSourceSelection] = useState(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [lastSelectionKey, setLastSelectionKey] = useState(null);
  const [layersTick, setLayersTick] = useState(0);
  const [filesTick, setFilesTick] = useState(0);
  const [clearSelectionToken, setClearSelectionToken] = useState(0);
  const [clearFilesToken, setClearFilesToken] = useState(0);
  const [keepTargetDrawOrder, setKeepTargetDrawOrder] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  const sourceLookup = useMemo(
    () => global.mapComparator.getLayerLookup(true),
    [layersTick],
  );
  const targetLookup = useMemo(
    () => global.mapComparator.getLayerLookup(false),
    [layersTick],
  );
  const sourceLayersFromOther =
    global.mapComparator.getLayersSource(true) === "other";
  const targetLayersFromOther =
    global.mapComparator.getLayersSource(false) === "other";
  const canReplaceAll = useMemo(
    () => global.mapComparator.canReplaceAllFromSource(),
    [layersTick, filesTick],
  );

  const handleClose = () => {
    setDiffOpen(false);
  };

  const sameKind =
    sourceSelection &&
    targetSelection &&
    sourceSelection.kind === targetSelection.kind &&
    sourceSelection.kind !== "baselayers";

  useEffect(() => {
    global.observer.subscribe("map-selection-changed", (m) => {
      setLastSelectionKey(m.key);
      if (m.key === "source") {
        setSourceSelection(m.value);
      } else if (m.key === "target") {
        setTargetSelection(m.value);
      }
    });
    global.observer.subscribe("map-layers-changed", () => {
      setLayersTick((value) => value + 1);
    });
    global.observer.subscribe("map-files-changed", () => {
      setFilesTick((value) => value + 1);
    });
    global.observer.subscribe("map-save-success", () => {
      setClearSelectionToken((value) => value + 1);
      setSourceSelection(null);
      setTargetSelection(null);
    });
    global.observer.subscribe("map-history-changed", (state) => {
      setCanUndo(Boolean(state?.canUndo));
    });
  }, []);

  useEffect(() => {
    const handleKeyUp = (e) => {
      if (e.key === "F5" && lastSelectionKey === "source" && sourceSelection) {
        e.preventDefault();
        global.observer.publish("map-copy-to-target", sourceSelection);
      }
    };

    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [lastSelectionKey, sourceSelection]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") {
        return;
      }
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") {
        return;
      }
      if (!canUndo) {
        return;
      }
      e.preventDefault();
      global.observer.publish("map-undo-target");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canUndo]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            mb: 1,
            color: "text.secondary",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          Drag a group or layer from the source tree onto a group in the target
          tree to copy it (or click on it). Drag inside the target tree to
          reorder. 1. Open layers config. 2. Open map config.
          <StatusLegend />
        </Typography>
        <Grid container spacing={2} sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <Grid item xs={6} sx={{ display: "flex", minHeight: 0 }}>
            <MapTree
              openButtonText={"Open source map config"}
              openLayersButtonText={"Open source layers"}
              id={"sourceMap"}
              lookup={sourceLookup}
              layersFromOther={sourceLayersFromOther}
              clearSelectionToken={clearSelectionToken}
              clearFilesToken={clearFilesToken}
            />
          </Grid>
          <Grid item xs={6} sx={{ display: "flex", minHeight: 0 }}>
            <MapTree
              openButtonText={"Open target map config"}
              openLayersButtonText={"Open target layers"}
              id={"targetMap"}
              lookup={targetLookup}
              layersFromOther={targetLayersFromOther}
              clearSelectionToken={clearSelectionToken}
              clearFilesToken={clearFilesToken}
            />
          </Grid>
        </Grid>
        <Grid container spacing={2} sx={{ flexShrink: 0 }} style={{ marginTop: 0 }}>
          <Grid
            item
            xs={6}
            style={{
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button
              disabled={!sameKind}
              variant="contained"
              size="small"
              sx={{ mb: "1rem", mr: "1rem" }}
              onClick={() => {
                setDiffOpen(!diffOpen);
                global.observer.publish("map-compare", {
                  source: sourceSelection,
                  target: targetSelection,
                });
              }}
              endIcon={<DifferenceIcon />}
            >
              Compare
            </Button>
            <Button
              disabled={!sameKind}
              variant="contained"
              size="small"
              sx={{ mb: "1rem", mr: "1rem" }}
              title={
                keepTargetDrawOrder
                  ? "Group: replaces the target group including nested groups and layers. Layer: replaces that one layer, keeps the target layer id and drawOrder."
                  : "Group: replaces the target group including nested groups and layers. Layer: replaces that one layer and keeps the target layer id."
              }
              onClick={() => {
                global.observer.publish("map-replace-in-target", {
                  source: sourceSelection,
                  target: targetSelection,
                  keepTargetDrawOrder,
                });
              }}
              endIcon={<ArrowForwardIcon />}
            >
              Replace in target
            </Button>
            <Button
              disabled={!canReplaceAll}
              variant="contained"
              size="small"
              sx={{ mb: "1rem", mr: "1rem" }}
              color="warning"
              title={
                "Replaces the entire target layerswitcher (groups and baselayers) with the source tree, remaps layer ids using both layers files, then opens the save dialog so you can overwrite the prod map file. Other map settings stay."
              }
              onClick={() => {
                const ok = window.confirm(
                  "Replace the entire target layerswitcher tree with the source tree?\n\nLayer ids will be remapped using the open layers files. Other map tools and settings are kept. You will then pick where to save the target map file.",
                );
                if (!ok) {
                  return;
                }
                global.observer.publish("map-replace-all-from-source");
              }}
              endIcon={<ContentCopyIcon />}
            >
              Replace all from source
            </Button>
            <Button
              disabled={
                !sourceSelection || sourceSelection.kind === "baselayers"
              }
              variant="contained"
              size="small"
              onClick={() => {
                global.observer.publish("map-copy-to-target", sourceSelection);
              }}
              sx={{ mb: "1rem" }}
              title={
                "Group: copies the whole group. Layer: copies only that layer into the parent group. Uses the prod layer id when you already copied the definition in Layer files (or when both layers files are open)."
              }
              endIcon={<ArrowForwardIcon />}
            >
              Copy to target [F5]
            </Button>
          </Grid>
          <Grid
            item
            xs={6}
            style={{ display: "flex", justifyContent: "flex-end" }}
          >
            <Grid item xs={0}>
              <FormControlLabel
                sx={{ mr: 2, mb: "1rem" }}
                control={
                  <Checkbox
                    size="small"
                    checked={keepTargetDrawOrder}
                    onChange={(event) =>
                      setKeepTargetDrawOrder(event.target.checked)
                    }
                  />
                }
                label="Keep target drawOrder"
                title="When replacing a single layer, keep the prod drawOrder instead of taking it from source."
              />
            </Grid>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                global.mapComparator.clearFiles();
                setSourceSelection(null);
                setTargetSelection(null);
                setLastSelectionKey(null);
                setCanUndo(false);
                setClearSelectionToken((value) => value + 1);
                setClearFilesToken((value) => value + 1);
                setLayersTick((value) => value + 1);
                setFilesTick((value) => value + 1);
              }}
              sx={{ mb: "1rem", mr: "1rem" }}
              title="Unload source and target map and layers files so you can open a new set."
              endIcon={<ClearAllIcon />}
            >
              Clear files
            </Button>
            <Button
              disabled={!canUndo}
              variant="contained"
              size="small"
              onClick={() => {
                global.observer.publish("map-undo-target");
              }}
              sx={{ mb: "1rem", mr: "1rem" }}
              title="Undo the last copy, replace, delete, or reorder on the target (Ctrl/Cmd+Z)."
              endIcon={<UndoIcon />}
            >
              Undo
            </Button>
            <Button
              disabled={
                !targetSelection || targetSelection.kind === "baselayers"
              }
              variant="contained"
              size="small"
              title={
                "Deletes the selected group (with nested groups and layers) or the selected single layer."
              }
              onClick={() => {
                global.observer.publish(
                  "map-delete-in-target",
                  targetSelection,
                );
              }}
              sx={{ mb: "1rem" }}
              endIcon={<DeleteForeverIcon />}
            >
              Delete
            </Button>
          </Grid>
        </Grid>
        <Dialog fullScreen open={diffOpen} onClose={handleClose}>
          <AppBar sx={{ position: "relative" }}>
            <Toolbar>
              <Typography sx={{ flex: 1 }} variant="h7" component="div">
                Comparing source "
                <span style={{ color: "#a6e22e" }}>
                  {getSelectionLabel(sourceSelection, sourceLookup)}
                </span>
                " with target "
                <span style={{ color: "#a6e22e" }}>
                  {getSelectionLabel(targetSelection, targetLookup)}
                </span>
                "
              </Typography>
              <IconButton edge="end" color="inherit" onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
          <DialogContent>
            <SelectionCompare
              oldData={stripTempProps(targetSelection?.node)}
              newData={stripTempProps(sourceSelection?.node)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DndProvider>
  );
};

export default MapTransferView;
