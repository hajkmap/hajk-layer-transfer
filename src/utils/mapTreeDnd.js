import {
  BASELAYERS_ID,
  cloneWithoutTemp,
  getLayerDisplay,
  nodeHasFlag,
} from "./mapSwitcher";

export const ROOT_ID = "__root__";

export const treeNodeId = (side, kind, id) => `${side}:${kind}:${id}`;

export const parseTreeNodeId = (treeId) => {
  const [side, kind, ...rest] = String(treeId || "").split(":");
  return { side, kind, id: rest.join(":") };
};

const layerText = (layer, lookup) => getLayerDisplay(layer.id, lookup).title;

/**
 * Hajk always shows sibling layers first, then nested groups.
 * Keep the transfer UI in that same order.
 */
const pushGroup = (nodes, group, side, parentTreeId, lookup) => {
  const id = treeNodeId(side, "group", group.id);
  nodes.push({
    id,
    parent: parentTreeId,
    droppable: true,
    text: group.name || group.id,
    data: {
      kind: "group",
      side,
      hajkId: group.id,
      hajkNode: group,
    },
  });

  (group.layers || []).forEach((layer) => {
    nodes.push({
      id: treeNodeId(side, "layer", layer.id),
      parent: id,
      droppable: false,
      text: layerText(layer, lookup),
      data: {
        kind: "layer",
        side,
        hajkId: layer.id,
        parentGroupId: group.id,
        hajkNode: layer,
      },
    });
  });

  (group.groups || []).forEach((child) => {
    pushGroup(nodes, child, side, id, lookup);
  });
};

export const switcherToFlatTree = (options, side, lookup) => {
  const nodes = [];
  if (!options) {
    return nodes;
  }

  nodes.push({
    id: treeNodeId(side, "baselayers", BASELAYERS_ID),
    parent: ROOT_ID,
    droppable: true,
    text: "Baselayers",
    data: {
      kind: "baselayers",
      side,
      hajkId: BASELAYERS_ID,
      hajkNode: { id: BASELAYERS_ID, name: "Baselayers" },
    },
  });

  (options.baselayers || []).forEach((layer) => {
    nodes.push({
      id: treeNodeId(side, "baselayer", layer.id),
      parent: treeNodeId(side, "baselayers", BASELAYERS_ID),
      droppable: false,
      text: layerText(layer, lookup),
      data: {
        kind: "baselayer",
        side,
        hajkId: layer.id,
        hajkNode: layer,
      },
    });
  });

  (options.groups || []).forEach((group) => {
    pushGroup(nodes, group, side, ROOT_ID, lookup);
  });

  return nodes;
};

const childrenOf = (nodes, parentId) =>
  nodes.filter((node) => node.parent === parentId);

const buildGroupFromFlat = (node, nodes) => {
  const meta = cloneWithoutTemp(node.data?.hajkNode || {});
  delete meta.layers;
  delete meta.groups;
  delete meta.childOrder;
  if (node.data?.hajkNode?.__is_added) {
    meta.__is_added = true;
  }
  if (node.data?.hajkNode?.__is_replaced) {
    meta.__is_replaced = true;
  }
  if (node.data?.hajkNode?.__possible_new) {
    meta.__possible_new = true;
  }
  if (node.data?.hajkNode?.__possible_change) {
    meta.__possible_change = true;
  }

  const parent =
    node.parent === ROOT_ID ? "-1" : parseTreeNodeId(node.parent).id;

  const layers = [];
  const groups = [];
  childrenOf(nodes, node.id).forEach((child) => {
    if (child.data?.kind === "layer") {
      layers.push(child.data.hajkNode);
    } else if (child.data?.kind === "group") {
      groups.push(buildGroupFromFlat(child, nodes));
    }
  });

  return {
    ...meta,
    parent,
    layers,
    groups,
  };
};

export const flatTreeToSwitcherParts = (nodes, side) => {
  const ofSide = nodes.filter(
    (node) => node.data?.side === side || parseTreeNodeId(node.id).side === side
  );
  const groups = [];
  const baselayers = [];

  childrenOf(ofSide, ROOT_ID).forEach((node) => {
    if (node.data?.kind === "baselayers") {
      childrenOf(ofSide, node.id).forEach((child) => {
        if (child.data?.kind === "baselayer") {
          baselayers.push(child.data.hajkNode);
        }
      });
    } else if (node.data?.kind === "group") {
      groups.push(buildGroupFromFlat(node, ofSide));
    }
  });

  return { groups, baselayers };
};

/** Map a mixed sibling index to an index inside only layers or only groups. */
export const toHajkKindIndex = (tree, parentId, kind, relativeIndex) => {
  if (typeof relativeIndex !== "number" || relativeIndex < 0) {
    return relativeIndex;
  }
  const siblings = childrenOf(tree, parentId);
  let sameKindBefore = 0;
  const limit = Math.min(relativeIndex, siblings.length);
  for (let i = 0; i < limit; i += 1) {
    if (siblings[i]?.data?.kind === kind) {
      sameKindBefore += 1;
    }
  }
  return sameKindBefore;
};

/** Force Hajk sibling order: layers, then groups. */
export const normalizeFlatTreeToHajkOrder = (nodes) => {
  const byParent = {};
  nodes.forEach((node) => {
    const key = node.parent;
    if (!byParent[key]) {
      byParent[key] = [];
    }
    byParent[key].push(node);
  });

  const ordered = [];
  const visitParent = (parentId) => {
    const children = byParent[parentId] || [];
    const baselayersFolder = children.filter(
      (node) => node.data?.kind === "baselayers"
    );
    const layers = children.filter(
      (node) =>
        node.data?.kind === "layer" || node.data?.kind === "baselayer"
    );
    const groups = children.filter((node) => node.data?.kind === "group");
    const rest = children.filter(
      (node) =>
        node.data?.kind !== "baselayers" &&
        node.data?.kind !== "layer" &&
        node.data?.kind !== "baselayer" &&
        node.data?.kind !== "group"
    );

    [...baselayersFolder, ...layers, ...groups, ...rest].forEach((node) => {
      ordered.push(node);
      if (node.droppable) {
        visitParent(node.id);
      }
    });
  };

  visitParent(ROOT_ID);
  return ordered;
};

export const filterFlatTree = (nodes, { textFilter, onlyFlags, lookup }) => {
  const needle = (textFilter || "").trim().toLowerCase();
  if (!needle && !onlyFlags) {
    return nodes;
  }

  const byId = {};
  nodes.forEach((node) => {
    byId[node.id] = node;
  });

  const matches = new Set();
  nodes.forEach((node) => {
    const hajk = node.data?.hajkNode || {};
    const info = getLayerDisplay(hajk.id, lookup);
    const textHit =
      !needle ||
      String(node.text || "")
        .toLowerCase()
        .includes(needle) ||
      String(hajk.id || "")
        .toLowerCase()
        .includes(needle) ||
      String(info.internalLayerName || "")
        .toLowerCase()
        .includes(needle);
    const flagHit = !onlyFlags || nodeHasFlag(hajk);
    if (textHit && flagHit && node.data?.kind !== "baselayers") {
      matches.add(node.id);
    }
  });

  const keep = new Set();
  matches.forEach((id) => {
    let current = id;
    while (current && current !== ROOT_ID) {
      keep.add(current);
      current = byId[current]?.parent;
    }
  });

  if (onlyFlags && !needle) {
    const baselayersId = nodes.find(
      (node) => node.data?.kind === "baselayers"
    )?.id;
    if (
      baselayersId &&
      nodes.some((node) => node.parent === baselayersId && keep.has(node.id))
    ) {
      keep.add(baselayersId);
    }
  }

  return nodes.filter((node) => keep.has(node.id));
};

export const dropParentInfo = (dropTargetId, dropTarget) => {
  if (!dropTargetId || dropTargetId === ROOT_ID) {
    return { kind: "root", hajkId: "-1" };
  }
  const parsed = parseTreeNodeId(dropTargetId);
  if (dropTarget?.data?.kind) {
    return {
      kind: dropTarget.data.kind,
      hajkId: dropTarget.data.hajkId,
    };
  }
  return { kind: parsed.kind, hajkId: parsed.id };
};

export const canAcceptDrop = (tree, dragSource, dropTargetId, dropTarget) => {
  if (!dragSource?.data) {
    return false;
  }
  const kind = dragSource.data.kind;
  if (kind === "baselayers") {
    return false;
  }
  if (dropTargetId === dragSource.id) {
    return false;
  }
  if (kind === "group" && Array.isArray(tree)) {
    const byId = {};
    tree.forEach((node) => {
      byId[node.id] = node;
    });
    let current = dropTargetId;
    while (current && current !== ROOT_ID) {
      if (current === dragSource.id) {
        return false;
      }
      current = byId[current]?.parent;
    }
  }
  const dest = dropParentInfo(dropTargetId, dropTarget);

  // Groups cannot sit above/among sibling layers (Hajk order is layers, then groups).
  if (dest.kind === "layer") {
    return kind === "layer";
  }
  if (kind === "layer") {
    return dest.kind === "group";
  }
  if (kind === "baselayer") {
    return dest.kind === "baselayers";
  }
  if (kind === "group") {
    return dest.kind === "root" || dest.kind === "group";
  }
  return false;
};

/**
 * Layer-on-layer: insert as sibling under the parent.
 * Group-on-layer: leave as layer target so canAcceptDrop rejects it.
 */
export const normalizeDropTarget = (
  tree,
  dropTargetId,
  dropTarget,
  relativeIndex,
  dragKind
) => {
  const kind = dropTarget?.data?.kind;
  if (kind !== "layer" && kind !== "baselayer") {
    return { dropTargetId, dropTarget, relativeIndex };
  }
  if (dragKind === "group") {
    return { dropTargetId, dropTarget, relativeIndex };
  }

  const parentId = dropTarget.parent;
  const siblings = Array.isArray(tree)
    ? tree.filter((node) => node.parent === parentId)
    : [];
  const siblingIndex = siblings.findIndex((node) => node.id === dropTarget.id);
  const parentNode = Array.isArray(tree)
    ? tree.find((node) => node.id === parentId)
    : null;

  return {
    dropTargetId: parentId,
    dropTarget: parentNode || null,
    relativeIndex: siblingIndex >= 0 ? siblingIndex : relativeIndex,
  };
};

export const destHajkParentId = (dropTargetId, dropTarget) => {
  const dest = dropParentInfo(dropTargetId, dropTarget);
  if (dest.kind === "root") {
    return "-1";
  }
  if (dest.kind === "group" || dest.kind === "baselayers") {
    return dest.hajkId;
  }
  if (dest.kind === "layer" && dropTarget?.data?.parentGroupId) {
    return dropTarget.data.parentGroupId;
  }
  return dest.hajkId;
};
