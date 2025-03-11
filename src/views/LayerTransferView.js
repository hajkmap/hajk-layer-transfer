import {
  AppBar,
  Button,
  Dialog,
  DialogContent,
  Grid,
  IconButton,
  Slide,
  Toolbar,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import LayerList from "../components/LayerList";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CloseIcon from "@mui/icons-material/Close";
import DifferenceIcon from "@mui/icons-material/Difference";
import global from "../models/Global";
import SelectionCompare from "./SelectionCompare";

// const Transition = React.forwardRef(function Transition(props, ref) {
//   return <Slide direction="up" ref={ref} {...props} />;
// });

const LayerTransferView = () => {
  const [targetSelection, setTargetSelection] = useState(null);
  const [sourceSelection, setSourceSelection] = useState(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [lastSelectionKey, setLastSelectionKey] = useState(null);

  const handleClose = () => {
    setDiffOpen(false);
  };

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
  }, []);

  // Add keyup event listener for copying to target when F5 is pressed,
  // but only if the last selection change was for "source".
  useEffect(() => {
    const handleKeyUp = (e) => {
      if (e.key === "F5" && lastSelectionKey === "source" && sourceSelection) {
        e.preventDefault(); // Prevent the default F5 refresh
        global.observer.publish("copy-to-target", sourceSelection);
      }
    };

    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [lastSelectionKey, sourceSelection]);

  return (
    <div>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <LayerList
            openButtonText={"Open source layer config"}
            id={"sourceData"}
          />
        </Grid>
        <Grid item xs={6}>
          <LayerList
            openButtonText={"Open target layer config"}
            id={"targetData"}
          />
        </Grid>
        <Grid
          item
          xs={6}
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          <Button
            disabled={!sourceSelection || !targetSelection}
            variant="contained"
            size="small"
            sx={{ mb: "1rem", mr: "1rem" }}
            onClick={() => {
              setDiffOpen(!diffOpen);
              global.observer.publish("compare", {
                source: sourceSelection,
                target: targetSelection,
              });
            }}
            endIcon={<DifferenceIcon />}
          >
            Compare
          </Button>
          <Button
            disabled={!sourceSelection || !targetSelection}
            variant="contained"
            size="small"
            sx={{ mb: "1rem", mr: "1rem" }}
            title={"Note: Layer will get the targets ID."}
            onClick={() => {
              global.observer.publish("replace-in-target", {
                source: sourceSelection,
                target: targetSelection,
              });
            }}
            endIcon={<ArrowForwardIcon />}
          >
            Replace in target
          </Button>
          <Button
            disabled={!sourceSelection}
            variant="contained"
            size="small"
            onClick={() => {
              global.observer.publish("copy-to-target", sourceSelection);
            }}
            sx={{ mb: "1rem" }}
            title={
              "Note: Layer will get a new ID. The type is either 'number' or 'uuid'. Check 'idType' in app.config.json"
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
          <Button
            disabled={!targetSelection}
            variant="contained"
            size="small"
            onClick={() => {
              global.observer.publish("delete-in-target", targetSelection);
            }}
            sx={{ mb: "1rem" }}
            endIcon={<DeleteForeverIcon />}
          >
            Delete
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
              <span style={{ color: "#a6e22e" }}>
                {sourceSelection?.caption}
              </span>
              " with target "
              <span style={{ color: "#a6e22e" }}>
                {targetSelection?.caption}
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
            oldData={targetSelection}
            newData={sourceSelection}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LayerTransferView;
