import React, { useEffect, useMemo, useRef, useState } from "react";
import FileOpenIcon from "@mui/icons-material/FileOpen";
import SaveAsIcon from "@mui/icons-material/SaveAs";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LayersIcon from "@mui/icons-material/Layers";
import MapIcon from "@mui/icons-material/Map";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LabelIcon from "@mui/icons-material/Label";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import {
  Button,
  Grid,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  ToggleButton,
  Typography,
} from "@mui/material";
import {
  Tree,
  mutateTree,
  mutateTreeWithIndex,
} from "@minoru/react-dnd-treeview";
import global from "../models/Global";
import {
  BASELAYERS_ID,
  getSwitcherOptions,
  layerIdsInSubtree,
  layerIdsOutsideGroup,
  removeGroup,
  removeLayer,
  replaceBaselayer,
  replaceGroup,
  replaceLayer,
  cloneWithoutTemp,
  resolveLiveSelection,
  getLayerDisplay,
  lookupSize,
  collectSubtreeIds,
  resolveTargetLayerId,
  remapGroupLayerIds,
  describeUnmappedLayers,
  copyHajkNodeIntoTarget,
  ensureAncestors,
  replaceSwitcherFromSource,
} from "../utils/mapSwitcher";
import {
  ROOT_ID,
  canAcceptDrop,
  destHajkParentId,
  filterFlatTree,
  flatTreeToSwitcherParts,
  normalizeDropTarget,
  normalizeFlatTreeToHajkOrder,
  switcherToFlatTree,
  toHajkKindIndex,
} from "../utils/mapTreeDnd";
import { getStatusColor } from "../utils/statusColors";

const getBgColor = (item) => getStatusColor(item);

const EMPTY_LOOKUP = {};

const MapDragPreview = ({ item }) => {
  const kind = item?.data?.kind;
  const Icon =
    kind === "group"
      ? FolderIcon
      : kind === "layer" || kind === "baselayer"
      ? LayersIcon
      : MapIcon;

  return (
    <div className="map-dnd-preview">
      <Icon fontSize="small" />
      <span>{item?.text || "Item"}</span>
    </div>
  );
};

const selectionKey = (kind, id) => `${kind}:${id}`;

const layerRowText = (node, lookup, hasLookup) => {
  const info = getLayerDisplay(node.id, lookup);
  const bits = [];

  if (!info.missing && info.title !== String(node.id)) {
    bits.push(node.id);
  }
  if (info.internalLayerName && info.internalLayerName !== info.title) {
    bits.push(info.internalLayerName);
  }
  if (hasLookup && info.missing) {
    bits.push("not in layers file");
  }
  bits.push(node.visibleAtStart ? "visible" : "hidden");
  bits.push(`drawOrder ${node.drawOrder ?? "-"}`);

  return {
    title: info.title,
    subtitle: bits.join(" · "),
  };
};

const MapTree = (props) => {
  const id = props.id;
  const isSourceData = id === "sourceMap";
  const side = isSourceData ? "source" : "target";
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [textFilter, setTextFilter] = useState("");
  const [filterChanges, setFilterChanges] = useState(false);
  const [dirty, setDirty] = useState(false);
  const treeRef = useRef(null);
  const mapComparator = global.mapComparator;

  const getPanelName = () => (isSourceData ? "source" : "target");

  const switcherOptions = data ? getSwitcherOptions(data) : null;
  const lookup = props.lookup || EMPTY_LOOKUP;
  const hasLookup = lookupSize(lookup) > 0;

  const refreshData = (nextData) => {
    setData(global.getDeepClone(nextData));
  };

  const deSelect = () => {
    setSelected(null);
    global.observer.publish("map-selection-changed", {
      key: getPanelName(),
      value: null,
    });
  };

  const publishSelection = (value) => {
    setSelected(value);
    global.observer.publish("map-selection-changed", {
      key: getPanelName(),
      value,
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

  const handleSelect = (kind, hajkNode, parentId) => {
    const live = resolveLiveSelection(switcherOptions, {
      kind,
      node: hajkNode,
      parentId,
    });
    const key = selectionKey(live.kind, live.node.id);
    const currentKey = selected
      ? selectionKey(selected.kind, selected.node.id)
      : null;
    if (key === currentKey) {
      deSelect();
      return;
    }
    publishSelection(live);
  };

  const runComparison = () => {
    mapComparator.runComparison().then((compared) => {
      if (!compared) {
        if (isSourceData) {
          const raw = mapComparator.getData("source");
          if (raw) {
            refreshData(raw);
          }
        }
        return;
      }
      if (isSourceData) {
        refreshData(compared.source);
        global.observer.publish("map-refresh-target", compared.target);
      } else {
        refreshData(compared.target);
        global.observer.publish("map-refresh-source", compared.source);
      }
    });
  };

  const openFile = () => {
    mapComparator
      .openFile(isSourceData)
      .then((fileData) => {
        setDirty(false);
        refreshData(fileData);
        if (!isSourceData) {
          global.observer.publish("map-history-changed", { canUndo: false });
        }
        global.observer.publish("map-files-changed");
        runComparison();
      })
      .catch((err) => {
        if (err === "not-a-map") {
          alert(
            "No layerswitcher tool was found in this file. Open a Hajk map config."
          );
        }
      });
  };

  const finishSave = (cleaned) => {
    const next = global.getDeepClone(cleaned);
    mapComparator.setData("target", next);
    mapComparator.setOriginal("target", global.getDeepClone(cleaned));
    setData(next);
    setDirty(false);
    deSelect();
    mapComparator.clearTargetHistory();
    global.observer.publish("map-save-success");
    global.observer.publish("map-history-changed", { canUndo: false });
    global.observer.publish("map-recompare");
    alert("Saved JSON");
  };

  const saveFile = () => {
    const cleaned = global.getCleanedMapData(data);
    global
      .writeJson(cleaned)
      .then(() => finishSave(cleaned))
      .catch(() => {});
  };

  const openLayersFile = () => {
    mapComparator
      .openLayersFile(isSourceData)
      .then(() => {
        global.observer.publish("map-layers-changed");
        global.observer.publish("map-recompare");
      })
      .catch((err) => {
        if (err === "not-layers") {
          alert(
            "This file does not look like a Hajk layers config. Open the layers JSON used by the Layer files tab."
          );
        }
      });
  };

  const resolveCopiedLayerId = (sourceId) =>
    resolveTargetLayerId(
      sourceId,
      mapComparator.getLayersFile(true),
      mapComparator.getLayersFile(false),
      mapComparator.getLayerIdMap()
    );

  const rememberTarget = () => {
    mapComparator.pushTargetHistory();
    global.observer.publish("map-history-changed", {
      canUndo: mapComparator.canUndoTarget(),
    });
  };

  const handleClearFiles = () => {
    setData(null);
    setDirty(false);
    setTextFilter("");
    setFilterChanges(false);
    deSelect();
  };

  const handleUndo = () => {
    const restored = mapComparator.undoTarget();
    if (!restored) {
      return;
    }
    setDirty(mapComparator.canUndoTarget());
    deSelect();
    refreshData(restored);
    global.observer.publish("map-recompare");
    global.observer.publish("map-history-changed", {
      canUndo: mapComparator.canUndoTarget(),
    });
  };

  const commitTarget = () => {
    mapComparator.setData("target", data);
    setDirty(true);
    deSelect();
    refreshData(data);
    global.observer.publish("map-recompare");
  };

  const handleDrop = (_newTree, dropOptions) => {
    if (isSourceData || !switcherOptions || !dropOptions?.dragSource?.data) {
      return;
    }

    const dragSource = dropOptions.dragSource;
    const fullTree = switcherToFlatTree(switcherOptions, "target", lookup);
    const normalized = normalizeDropTarget(
      fullTree,
      dropOptions.dropTargetId,
      dropOptions.dropTarget,
      dropOptions.relativeIndex,
      dragSource.data.kind
    );

    if (
      !canAcceptDrop(
        fullTree,
        dragSource,
        normalized.dropTargetId,
        normalized.dropTarget
      )
    ) {
      return;
    }

    if (dragSource.data.side === "source") {
      const destParentId = destHajkParentId(
        normalized.dropTargetId,
        normalized.dropTarget
      );
      let destIndex = normalized.relativeIndex;
      if (
        dragSource.data.kind === "group" &&
        destParentId === "-1" &&
        typeof destIndex === "number"
      ) {
        destIndex = Math.max(0, destIndex - 1);
      } else if (
        (dragSource.data.kind === "group" ||
          dragSource.data.kind === "layer") &&
        typeof destIndex === "number"
      ) {
        destIndex = toHajkKindIndex(
          fullTree,
          normalized.dropTargetId,
          dragSource.data.kind,
          destIndex
        );
      }
      rememberTarget();
      const result = copyHajkNodeIntoTarget({
        targetOptions: switcherOptions,
        kind: dragSource.data.kind,
        node: dragSource.data.hajkNode,
        destParentId,
        destIndex,
        resolveCopiedLayerId,
      });
      if (!result.ok) {
        const restored = mapComparator.undoTarget();
        if (restored) {
          refreshData(restored);
        }
        global.observer.publish("map-history-changed", {
          canUndo: mapComparator.canUndoTarget(),
        });
        alert(result.error);
        return;
      }
      commitTarget();
      return;
    }

    rememberTarget();
    const nextTree =
      normalized.relativeIndex == null
        ? mutateTree(fullTree, dragSource.id, normalized.dropTargetId)
        : mutateTreeWithIndex(
            fullTree,
            dragSource.id,
            normalized.dropTargetId,
            normalized.relativeIndex
          );
    const parts = flatTreeToSwitcherParts(
      normalizeFlatTreeToHajkOrder(nextTree),
      "target"
    );
    switcherOptions.groups = parts.groups;
    switcherOptions.baselayers = parts.baselayers;
    commitTarget();
  };

  const handleReplaceItem = (payload) => {
    if (!data || !switcherOptions || !payload?.source || !payload?.target) {
      return;
    }

    let sourceSelection = payload.source;
    let targetSelection = payload.target;

    if (sourceSelection.kind !== targetSelection.kind) {
      alert("Source and target must be the same kind (group, layer, or baselayer).");
      return;
    }

    if (sourceSelection.kind === "baselayers") {
      alert("Select a group or layer to replace.");
      return;
    }

    rememberTarget();
    let replaced = false;
    if (sourceSelection.kind === "group") {
      const clone = cloneWithoutTemp(sourceSelection.node);
      const unmapped = remapGroupLayerIds(clone, resolveCopiedLayerId);
      if (unmapped.length) {
        mapComparator.undoTarget();
        global.observer.publish("map-history-changed", {
          canUndo: mapComparator.canUndoTarget(),
        });
        alert(
          "Could not match these layers to the target layers file. Copy each layer definition first in Layer files, then open source and target layers here: " +
            describeUnmappedLayers(unmapped)
        );
        return;
      }

      const duplicates = [...layerIdsInSubtree(clone)].filter((layerId) =>
        layerIdsOutsideGroup(switcherOptions, targetSelection.node.id).has(
          layerId
        )
      );
      if (duplicates.length) {
        mapComparator.undoTarget();
        global.observer.publish("map-history-changed", {
          canUndo: mapComparator.canUndoTarget(),
        });
        alert(
          `Cannot replace this group. These layers already exist elsewhere in the target: ${duplicates.join(
            ", "
          )}`
        );
        return;
      }
      replaced = replaceGroup(switcherOptions, targetSelection.node.id, clone);
      if (!replaced) {
        mapComparator.undoTarget();
        global.observer.publish("map-history-changed", {
          canUndo: mapComparator.canUndoTarget(),
        });
        alert("Could not find the selected group in the target map.");
        return;
      }
    } else if (sourceSelection.kind === "layer") {
      replaced = replaceLayer(
        switcherOptions,
        targetSelection.node.id,
        sourceSelection.node,
        { keepDrawOrder: Boolean(payload.keepTargetDrawOrder) }
      );
      if (!replaced) {
        mapComparator.undoTarget();
        global.observer.publish("map-history-changed", {
          canUndo: mapComparator.canUndoTarget(),
        });
        alert("Could not find the selected layer in the target map.");
        return;
      }
    } else if (sourceSelection.kind === "baselayer") {
      replaced = replaceBaselayer(
        switcherOptions,
        targetSelection.node.id,
        sourceSelection.node,
        { keepDrawOrder: Boolean(payload.keepTargetDrawOrder) }
      );
      if (!replaced) {
        mapComparator.undoTarget();
        global.observer.publish("map-history-changed", {
          canUndo: mapComparator.canUndoTarget(),
        });
        alert("Could not find the selected baselayer in the target map.");
        return;
      }
    }

    commitTarget();
  };

  const handleDeleteItem = (selection) => {
    if (!data || !switcherOptions || !selection?.node) {
      return;
    }

    if (
      selection.kind !== "group" &&
      selection.kind !== "layer" &&
      selection.kind !== "baselayer"
    ) {
      return;
    }

    rememberTarget();
    if (selection.kind === "group") {
      removeGroup(switcherOptions.groups, selection.node.id);
    } else if (selection.kind === "layer") {
      removeLayer(switcherOptions.groups, selection.node.id);
    } else {
      switcherOptions.baselayers = (switcherOptions.baselayers || []).filter(
        (layer) => layer.id !== selection.node.id
      );
    }

    commitTarget();
  };

  const handleCopyItem = (selection) => {
    if (!data || !switcherOptions || !selection?.node) {
      return;
    }
    const destParentId =
      selection.kind === "baselayer"
        ? BASELAYERS_ID
        : selection.node.parent || selection.parentId || "-1";
    rememberTarget();
    const sourceOptions = getSwitcherOptions(mapComparator.getData("source"));
    if (
      sourceOptions &&
      (selection.kind === "group" || selection.kind === "layer") &&
      destParentId &&
      destParentId !== "-1"
    ) {
      ensureAncestors(switcherOptions, sourceOptions, destParentId);
    }
    const result = copyHajkNodeIntoTarget({
      targetOptions: switcherOptions,
      kind: selection.kind,
      node: selection.node,
      destParentId,
      resolveCopiedLayerId,
    });
    if (!result.ok) {
      const restored = mapComparator.undoTarget();
      if (restored) {
        refreshData(restored);
      }
      global.observer.publish("map-history-changed", {
        canUndo: mapComparator.canUndoTarget(),
      });
      alert(result.error);
      return;
    }
    commitTarget();
  };

  const handleReplaceAllFromSource = () => {
    if (!data || !switcherOptions) {
      return;
    }
    if (!mapComparator.canReplaceAllFromSource()) {
      alert(
        "Open both map configs and both layers files (source and target) before replacing the whole tree."
      );
      return;
    }

    rememberTarget();
    const sourceOptions = getSwitcherOptions(mapComparator.getData("source"));
    const result = replaceSwitcherFromSource(
      switcherOptions,
      sourceOptions,
      resolveCopiedLayerId
    );
    if (!result.ok) {
      const restored = mapComparator.undoTarget();
      if (restored) {
        refreshData(restored);
      }
      global.observer.publish("map-history-changed", {
        canUndo: mapComparator.canUndoTarget(),
      });
      alert(result.error);
      return;
    }

    mapComparator.setData("target", data);
    setDirty(true);
    deSelect();
    refreshData(data);
    global.observer.publish("map-recompare");

    const cleaned = global.getCleanedMapData(data);
    global
      .writeJson(cleaned)
      .then(() => finishSave(cleaned))
      .catch(() => {
        // Save dialog cancelled: keep the replaced tree as unsaved changes.
      });
  };

  useEffect(() => {
    if (isSourceData) {
      global.observer.unsubscribe("map-refresh-source");
      global.observer.unsubscribe("map-recompare");
      global.observer.subscribe("map-refresh-source", refreshData);
      global.observer.subscribe("map-recompare", runComparison);
      return () => {
        global.observer.unsubscribe("map-refresh-source");
        global.observer.unsubscribe("map-recompare");
      };
    }

    global.observer.unsubscribe("map-copy-to-target");
    global.observer.unsubscribe("map-replace-in-target");
    global.observer.unsubscribe("map-delete-in-target");
    global.observer.unsubscribe("map-replace-all-from-source");
    global.observer.unsubscribe("map-refresh-target");
    global.observer.unsubscribe("map-undo-target");
    global.observer.subscribe("map-copy-to-target", handleCopyItem);
    global.observer.subscribe("map-replace-in-target", handleReplaceItem);
    global.observer.subscribe("map-delete-in-target", handleDeleteItem);
    global.observer.subscribe(
      "map-replace-all-from-source",
      handleReplaceAllFromSource
    );
    global.observer.subscribe("map-refresh-target", refreshData);
    global.observer.subscribe("map-undo-target", handleUndo);
    return () => {
      global.observer.unsubscribe("map-copy-to-target");
      global.observer.unsubscribe("map-replace-in-target");
      global.observer.unsubscribe("map-delete-in-target");
      global.observer.unsubscribe("map-replace-all-from-source");
      global.observer.unsubscribe("map-refresh-target");
      global.observer.unsubscribe("map-undo-target");
    };
  }, [data]);

  const treeData = useMemo(() => {
    if (!switcherOptions) {
      return [];
    }
    return filterFlatTree(switcherToFlatTree(switcherOptions, side, lookup), {
      textFilter,
      onlyFlags: filterChanges,
      lookup,
    });
  }, [switcherOptions, side, lookup, textFilter, filterChanges]);

  const selectedSubtree = useMemo(() => {
    if (!selected?.node) {
      return null;
    }
    if (selected.kind === "group") {
      const ids = collectSubtreeIds(selected.node);
      return {
        rootKey: selectionKey("group", selected.node.id),
        groupIds: ids.groupIds,
        layerIds: ids.layerIds,
      };
    }
    if (selected.kind === "layer" || selected.kind === "baselayer") {
      return {
        rootKey: selectionKey(selected.kind, selected.node.id),
        groupIds: new Set(),
        layerIds: new Set([selected.node.id]),
      };
    }
    return null;
  }, [selected]);

  const hasData = Boolean(switcherOptions);

  const isNodeSelected = (node) => {
    const kind = node.data?.kind;
    const hajkId = node.data?.hajkId;
    if (!selectedSubtree || !kind) {
      return false;
    }
    if (kind === "group") {
      return selectedSubtree.groupIds.has(hajkId);
    }
    if (kind === "layer" || kind === "baselayer") {
      return selectedSubtree.layerIds.has(hajkId);
    }
    return false;
  };

  const isNodeRootSelected = (node) =>
    selectedSubtree?.rootKey === selectionKey(node.data?.kind, node.data?.hajkId);

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
        <Grid item xs={isSourceData ? 12 : 8}>
          <Button
            variant="contained"
            size="small"
            onClick={openFile}
            sx={{ mb: "0.5rem", mr: "0.5rem" }}
            startIcon={<FileOpenIcon />}
          >
            {props.openButtonText}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={openLayersFile}
            sx={{ mb: "0.5rem" }}
            startIcon={<LabelIcon />}
          >
            {props.openLayersButtonText || "Open layers"}
          </Button>
        </Grid>
        <Grid
          item
          xs={isSourceData ? 12 : 4}
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          {isSourceData === false && (
            <Button
              disabled={!hasData || !dirty}
              variant="contained"
              size="small"
              onClick={saveFile}
              sx={{ mb: "0.5rem" }}
              startIcon={<SaveAsIcon />}
              title={
                dirty
                  ? "Writes the full map file, but only groups and baselayers in the layerswitcher are changed. Other tools and map settings are kept."
                  : "No unsaved changes"
              }
            >
              Save to file
            </Button>
          )}
        </Grid>
      </Grid>
      <Typography
        variant="caption"
        sx={{ display: "block", mb: "0.75rem", flexShrink: 0 }}
      >
        {hasLookup
          ? props.layersFromOther
            ? `Showing names from the other panel's layers file (${lookupSize(
                lookup
              )})`
            : `Showing layer names (${lookupSize(lookup)})`
          : "Open a layers file to show names instead of ids"}
        {mapComparator.hasBothMaps() && !mapComparator.hasBothLayersFiles()
          ? ". Comparison colors wait until both source and target layers files are open."
          : ""}
      </Typography>
      <Grid
        container
        spacing={1}
        sx={{ mb: "0.75rem", flexShrink: 0 }}
        alignItems="center"
      >
        <Grid item xs={6}>
          <ToggleButton
            disabled={!hasData}
            value={filterChanges}
            size="small"
            title="Show only possible additions/changes"
            onClick={() => {
              setFilterChanges(!filterChanges);
              deSelect();
            }}
          >
            {filterChanges ? <FilterAltIcon /> : <FilterAltOffIcon />}
          </ToggleButton>
          <IconButton
            disabled={!hasData}
            size="small"
            title="Expand all"
            onClick={() => treeRef.current?.openAll()}
          >
            <UnfoldMoreIcon fontSize="small" />
          </IconButton>
          <IconButton
            disabled={!hasData}
            size="small"
            title="Collapse all"
            onClick={() => treeRef.current?.closeAll()}
          >
            <UnfoldLessIcon fontSize="small" />
          </IconButton>
        </Grid>
        <Grid item xs={6}>
          <TextField
            value={textFilter}
            label="Text filter"
            variant="outlined"
            size="small"
            sx={{ width: "100%" }}
            disabled={!hasData}
            onChange={(e) => {
              setTextFilter(e.target.value);
              deSelect();
            }}
          />
        </Grid>
      </Grid>
      <div
        className="map-dnd-tree"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          border: `1px solid ${global.theme.palette.grey["800"]}`,
          borderRadius: global.theme.shape.borderRadius,
        }}
      >
        {hasData ? (
          <Tree
            ref={treeRef}
            tree={treeData}
            rootId={ROOT_ID}
            sort={false}
            insertDroppableFirst={false}
            enableAnimateExpand={false}
            initialOpen={true}
            dropTargetOffset={8}
            dragPreviewRender={(monitorProps) => (
              <MapDragPreview item={monitorProps.item} />
            )}
            onDrop={handleDrop}
            canDrag={(node) => node?.data?.kind !== "baselayers"}
            canDrop={(tree, dropOpt) => {
              if (isSourceData) {
                return false;
              }
              return canAcceptDrop(
                tree,
                dropOpt.dragSource,
                dropOpt.dropTargetId,
                dropOpt.dropTarget
              );
            }}
            placeholderRender={(_node, { depth }) => (
              <div
                style={{
                  height: 3,
                  background: "#90caf9",
                  marginLeft: depth * 16,
                  borderRadius: 2,
                }}
              />
            )}
            classes={{
              root: isSourceData
                ? "map-dnd-tree-root"
                : "map-dnd-tree-root map-dnd-tree-root-target",
              draggingSource: "map-dnd-dragging",
              dropTarget: "map-dnd-drop-target",
              placeholder: "map-dnd-placeholder",
              listItem: (node, params) => {
                const kind = node.data?.kind;
                if (
                  (kind === "group" || kind === "baselayers") &&
                  params.hasChild
                ) {
                  return "map-dnd-group-item";
                }
                return "";
              },
            }}
            render={(node, { depth, isOpen, onToggle, isDropTarget, hasChild }) => {
              const kind = node.data?.kind;
              const hajkNode = node.data?.hajkNode;
              const isGroup = kind === "group" || kind === "baselayers";
              const selectedRole = isNodeRootSelected(node)
                ? "root"
                : isNodeSelected(node)
                ? "child"
                : null;
              const layerText =
                kind === "layer" || kind === "baselayer"
                  ? layerRowText(hajkNode, lookup, hasLookup)
                  : null;
              const secondary =
                kind === "group"
                  ? `${(hajkNode.layers || []).length} layers, ${
                      (hajkNode.groups || []).length
                    } groups`
                  : kind === "baselayers"
                  ? "Background layers"
                  : layerText.subtitle;

              return (
                <ListItemButton
                  dense
                  className={
                    isGroup && hasChild
                      ? "map-dnd-row map-dnd-group-row"
                      : "map-dnd-row"
                  }
                  selected={Boolean(selectedRole)}
                  sx={{
                    cursor: kind === "baselayers" ? "default" : "grab",
                    pl: 1 + depth * 1.5,
                    py: 0.25,
                    borderBottom: "1px solid rgb(51 50 50)",
                    bgcolor: getBgColor(hajkNode),
                    outline: isDropTarget ? "1px dashed #90caf9" : "none",
                    "&.Mui-selected": {
                      backgroundColor:
                        getBgColor(hajkNode) ||
                        (selectedRole === "root"
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(255,255,255,0.05)"),
                      borderLeft:
                        selectedRole === "root"
                          ? "4px solid #fff"
                          : "4px solid rgba(255,255,255,0.4)",
                    },
                  }}
                  onClick={() => {
                    if (kind === "baselayers") {
                      return;
                    }
                    handleSelect(
                      kind,
                      hajkNode,
                      kind === "layer"
                        ? node.data.parentGroupId
                        : hajkNode.parent || "-1"
                    );
                  }}
                >
                  {isGroup ? (
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle();
                      }}
                      sx={{ mr: 0.5 }}
                    >
                      {isOpen ? (
                        <ExpandMoreIcon fontSize="small" />
                      ) : (
                        <ChevronRightIcon fontSize="small" />
                      )}
                    </IconButton>
                  ) : (
                    <span style={{ width: 34, display: "inline-block" }} />
                  )}
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {kind === "baselayers" ? (
                      <MapIcon fontSize="small" />
                    ) : kind === "group" ? (
                      isOpen ? (
                        <FolderOpenIcon fontSize="small" />
                      ) : (
                        <FolderIcon fontSize="small" />
                      )
                    ) : (
                      <LayersIcon fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    sx={{ my: 0 }}
                    primary={isGroup ? node.text : layerText.title}
                    secondary={secondary}
                    primaryTypographyProps={{ variant: "body2" }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItemButton>
              );
            }}
          />
        ) : (
          <Typography variant="body2" sx={{ p: 2, color: "text.secondary" }}>
            Open a Hajk map config to show the layerswitcher tree.
          </Typography>
        )}
      </div>
    </Paper>
  );
};

export default MapTree;
