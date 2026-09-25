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
import React, { useEffect, useState } from "react";
import LayerList from "../components/LayerList";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CloseIcon from "@mui/icons-material/Close";
import DifferenceIcon from "@mui/icons-material/Difference";
import UndoIcon from "@mui/icons-material/Undo";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import global from "../models/Global";
import SelectionCompare from "./SelectionCompare";
import StatusLegend from "../components/StatusLegend";

// const Transition = React.forwardRef(function Transition(props, ref) {
//   return <Slide direction="up" ref={ref} {...props} />;
// });

const LayerTransferView = () => {
  const [targetSelection, setTargetSelection] = useState(null);
  const [sourceSelection, setSourceSelection] = useState(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [lastSelectionKey, setLastSelectionKey] = useState(null);
  const [clearSelectionToken, setClearSelectionToken] = useState(0);
  const [clearFilesToken, setClearFilesToken] = useState(0);
  const [keepSourceId, setKeepSourceId] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  const handleClose = () => {
    setDiffOpen(false);
  };

  const sourceIsMulti = Array.isArray(sourceSelection);
  const targetIsMulti = Array.isArray(targetSelection);
  const sourceCount = sourceIsMulti
    ? sourceSelection.length
    : sourceSelection
      ? 1
      : 0;
  const targetCount = targetIsMulti
    ? targetSelection.length
    : targetSelection
      ? 1
      : 0;
  const sourceSingle =
    sourceIsMulti && sourceSelection.length === 1
      ? sourceSelection[0]
      : !sourceIsMulti
        ? sourceSelection
        : null;
  const targetSingle =
    targetIsMulti && targetSelection.length === 1
      ? targetSelection[0]
      : !targetIsMulti
        ? targetSelection
        : null;
  const canCompare = Boolean(sourceSingle && targetSingle);
  const canReplace = sourceCount > 0 && sourceCount === targetCount;
  const canCopy = sourceCount > 0;
  const canDelete = targetCount > 0;

  // Subscribe to global selection changes and track the last selection key.
  useEffect(() => {
    global.observer.subscribe("selection-changed", (m) => {
      setLastSelectionKey(m.key);
      if (m.key === "source") {
        setSourceSelection(m.value);
      } else if (m.key === "target") {
        setTargetSelection(m.value);
      }
    });
    global.observer.subscribe("layer-save-success", () => {
      setClearSelectionToken((value) => value + 1);
      setSourceSelection(null);
      setTargetSelection(null);
    });
    global.observer.subscribe("layer-history-changed", (state) => {
      setCanUndo(Boolean(state?.canUndo));
    });
  }, []);

  // Add keyup event listener for copying to target when F5 is pressed,
  // but only if the last selection change was for "source".
  useEffect(() => {
    const handleKeyUp = (e) => {
      if (e.key === "F5" && lastSelectionKey === "source" && sourceCount > 0) {
        e.preventDefault(); // Prevent the default F5 refresh
        global.observer.publish("copy-to-target", {
          items: sourceSelection,
          keepSourceId,
        });
      }
    };

    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [lastSelectionKey, sourceSelection, sourceCount, keepSourceId]);

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
      global.observer.publish("layer-undo-target");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canUndo]);

  return (
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
          flexShrink: 0,
        }}
      >
        Hold Ctrl/Cmd to multi-select.
        <StatusLegend />
      </Typography>
      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Grid item xs={6} sx={{ display: "flex", minHeight: 0 }}>
          <LayerList
            openButtonText={"Open source layer config"}
            id={"sourceData"}
            clearSelectionToken={clearSelectionToken}
            clearFilesToken={clearFilesToken}
          />
        </Grid>
        <Grid item xs={6} sx={{ display: "flex", minHeight: 0 }}>
          <LayerList
            openButtonText={"Open target layer config"}
            id={"targetData"}
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
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ marginRight: "auto", marginBottom: "1rem" }}>
            <FormControlLabel
              sx={{ display: "flex" }}
              control={
                <Checkbox
                  size="small"
                  checked={keepSourceId}
                  onChange={(event) => setKeepSourceId(event.target.checked)}
                />
              }
              label="Use source IDs in target (on copy)"
              title="Copy will keep the source (dev) layer ID in the target (prod) file."
            />
          </div>
          <Button
            disabled={!canCompare}
            variant="contained"
            size="small"
            sx={{ mb: "1rem", mr: "1rem" }}
            onClick={() => {
              setDiffOpen(!diffOpen);
              global.observer.publish("compare", {
                source: sourceSingle,
                target: targetSingle,
              });
            }}
            endIcon={<DifferenceIcon />}
          >
            Compare
          </Button>
          <Button
            disabled={!canReplace}
            variant="contained"
            size="small"
            sx={{ mb: "1rem", mr: "1rem" }}
            title={
              sourceCount > 1
                ? `Replace ${sourceCount} pairs in selection order. Each source keeps its paired target id.`
                : "Note: Layer will get the targets ID. Hold Ctrl/Cmd to multi-select matching pairs on both sides."
            }
            onClick={() => {
              global.observer.publish("replace-in-target", {
                source: sourceSelection,
                target: targetSelection,
              });
            }}
            endIcon={<ArrowForwardIcon />}
          >
            {sourceCount > 1
              ? `Replace ${sourceCount} in target`
              : "Replace in target"}
          </Button>
          <Button
            disabled={!canCopy}
            variant="contained"
            size="small"
            onClick={() => {
              global.observer.publish("copy-to-target", {
                items: sourceSelection,
                keepSourceId,
              });
            }}
            sx={{ mb: "1rem" }}
            title={
              sourceCount > 1
                ? keepSourceId
                  ? `Copy ${sourceCount} selected layers and keep their source IDs.`
                  : `Copy ${sourceCount} selected layers. Each gets a new ID.`
                : keepSourceId
                  ? "The copied layer will keep the source ID."
                  : "Note: Layer will get a new ID. The type is either 'number' or 'uuid'. Check 'idType' in app.config.json. Hold Ctrl/Cmd to multi-select."
            }
            endIcon={<ArrowForwardIcon />}
          >
            {sourceCount > 1
              ? `Copy ${sourceCount} to target [F5]`
              : "Copy to target [F5]"}
          </Button>
        </Grid>
        <Grid
          item
          xs={6}
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              global.listComparator.clearFiles();
              setSourceSelection(null);
              setTargetSelection(null);
              setLastSelectionKey(null);
              setCanUndo(false);
              setClearSelectionToken((value) => value + 1);
              setClearFilesToken((value) => value + 1);
            }}
            sx={{ mb: "1rem", mr: "1rem" }}
            title="Unload source and target layer files so you can open a new pair."
            endIcon={<ClearAllIcon />}
          >
            Clear files
          </Button>
          <Button
            disabled={!canUndo}
            variant="contained"
            size="small"
            onClick={() => {
              global.observer.publish("layer-undo-target");
            }}
            sx={{ mb: "1rem", mr: "1rem" }}
            title="Undo the last copy, replace, or delete on the target (Ctrl/Cmd+Z)."
            endIcon={<UndoIcon />}
          >
            Undo
          </Button>
          <Button
            disabled={!canDelete}
            variant="contained"
            size="small"
            onClick={() => {
              global.observer.publish("delete-in-target", targetSelection);
            }}
            sx={{ mb: "1rem" }}
            title={
              targetCount > 1
                ? `Delete ${targetCount} selected target layers.`
                : undefined
            }
            endIcon={<DeleteForeverIcon />}
          >
            {targetCount > 1 ? `Delete ${targetCount}` : "Delete"}
          </Button>
        </Grid>
      </Grid>
      <Dialog
        fullScreen
        open={diffOpen}
        onClose={handleClose}
        // TransitionComponent={Transition}
      >
        <AppBar sx={{ position: "relative" }}>
          <Toolbar>
            <Typography sx={{ flex: 1 }} variant="h7" component="div">
              Comparing source "
              <span style={{ color: "#a6e22e" }}>{sourceSingle?.caption}</span>"
              with target "
              <span style={{ color: "#a6e22e" }}>{targetSingle?.caption}</span>"
            </Typography>
            <IconButton edge="end" color="inherit" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <DialogContent>
          <SelectionCompare oldData={targetSingle} newData={sourceSingle} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LayerTransferView;
