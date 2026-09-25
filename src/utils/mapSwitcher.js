export const BASELAYERS_ID = "__baselayers__";

export const getLayerSwitcher = (mapData) => {
  if (!mapData) {
    return null;
  }

  if (mapData.type === "layerswitcher") {
    return mapData;
  }

  const tools = Array.isArray(mapData) ? mapData : mapData.tools;
  if (!Array.isArray(tools)) {
    return null;
  }

  return tools.find((tool) => tool.type === "layerswitcher") || null;
};

export const getSwitcherOptions = (mapData) => {
  return getLayerSwitcher(mapData)?.options || null;
};

export const mergeSwitcherTree = (originalMap, workingMap) => {
  const base = cloneValue(originalMap || workingMap);
  const baseOptions = getSwitcherOptions(base);
  const workingOptions = getSwitcherOptions(workingMap);

  if (!baseOptions || !workingOptions) {
    return stripTempProps(cloneValue(workingMap));
  }

  baseOptions.groups = stripTempProps(cloneValue(workingOptions.groups || []));
  baseOptions.baselayers = stripTempProps(
    cloneValue(workingOptions.baselayers || []),
  );

  return base;
};

export const isLayersConfig = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  if (getSwitcherOptions(data)) {
    return false;
  }

  return Object.values(data).some(
    (value) =>
      Array.isArray(value) &&
      value.some((item) => item && typeof item === "object" && item.id != null),
  );
};

export const buildLayerLookup = (layersFile) => {
  const byId = {};

  if (
    !layersFile ||
    typeof layersFile !== "object" ||
    Array.isArray(layersFile)
  ) {
    return byId;
  }

  Object.keys(layersFile).forEach((type) => {
    const list = layersFile[type];
    if (!Array.isArray(list)) {
      return;
    }

    list.forEach((layer) => {
      if (!layer || layer.id == null) {
        return;
      }

      byId[String(layer.id)] = {
        id: layer.id,
        caption: layer.caption || layer.name || "",
        internalLayerName: layer.internalLayerName || "",
        type,
      };
    });
  });

  return byId;
};

export const getLayerDisplay = (layerId, lookup) => {
  const hit = lookup && lookup[String(layerId)];
  if (!hit) {
    return {
      title: String(layerId ?? ""),
      internalLayerName: "",
      type: "",
      missing: true,
    };
  }

  return {
    title: hit.caption || hit.internalLayerName || String(layerId),
    internalLayerName: hit.internalLayerName,
    type: hit.type,
    missing: false,
  };
};

export const lookupSize = (lookup) => (lookup ? Object.keys(lookup).length : 0);

export const listLayers = (layersFile) => {
  const layers = [];
  if (
    !layersFile ||
    typeof layersFile !== "object" ||
    Array.isArray(layersFile)
  ) {
    return layers;
  }

  Object.keys(layersFile).forEach((type) => {
    const list = layersFile[type];
    if (!Array.isArray(list)) {
      return;
    }
    list.forEach((layer) => {
      if (layer && layer.id != null) {
        layers.push({
          id: layer.id,
          caption: layer.caption || layer.name || "",
          internalLayerName: layer.internalLayerName || "",
          type,
        });
      }
    });
  });

  return layers;
};

const normalizeName = (value) => (value || "").trim().toLowerCase();

const findMatchingTargetLayer = (sourceLayer, targetLayers) => {
  if (!sourceLayer || !targetLayers.length) {
    return null;
  }

  const caption = normalizeName(sourceLayer.caption);
  const internal = normalizeName(sourceLayer.internalLayerName);

  const byCaption = caption
    ? targetLayers.filter((layer) => normalizeName(layer.caption) === caption)
    : [];
  const byInternal = internal
    ? targetLayers.filter(
        (layer) => normalizeName(layer.internalLayerName) === internal,
      )
    : [];

  const typedCaption = byCaption.filter(
    (layer) => layer.type === sourceLayer.type,
  );
  if (typedCaption.length === 1) {
    return typedCaption[0];
  }
  if (byCaption.length === 1) {
    return byCaption[0];
  }
  const typedInternal = byInternal.filter(
    (layer) => layer.type === sourceLayer.type,
  );
  if (typedInternal.length === 1) {
    return typedInternal[0];
  }
  if (byInternal.length === 1) {
    return byInternal[0];
  }
  return (
    typedCaption[0] || byCaption[0] || typedInternal[0] || byInternal[0] || null
  );
};

export const resolveTargetLayerId = (
  sourceId,
  sourceLayersFile,
  targetLayersFile,
  sessionMap = {},
) => {
  const sourceKey = String(sourceId);
  if (sessionMap && sessionMap[sourceKey] != null) {
    return {
      id: sessionMap[sourceKey],
      how: "session",
      caption: "",
      missing: false,
    };
  }

  const sourceLayers = listLayers(sourceLayersFile);
  const targetLayers = listLayers(targetLayersFile);
  const sourceLayer = sourceLayers.find(
    (layer) => String(layer.id) === sourceKey,
  );
  const sameId = targetLayers.find((layer) => String(layer.id) === sourceKey);
  if (sameId) {
    return {
      id: sameId.id,
      how: "same-id",
      caption: sameId.caption,
      missing: false,
    };
  }

  const matched = findMatchingTargetLayer(sourceLayer, targetLayers);
  if (matched) {
    return {
      id: matched.id,
      how: "name",
      caption: sourceLayer?.caption || matched.caption,
      missing: false,
    };
  }

  return {
    id: sourceId,
    how: "unmapped",
    caption: sourceLayer?.caption || "",
    missing: true,
  };
};

export const remapGroupLayerIds = (group, resolveId, unmapped = []) => {
  (group.layers || []).forEach((layer) => {
    const resolved = resolveId(layer.id);
    if (resolved.missing) {
      unmapped.push({
        sourceId: layer.id,
        caption: resolved.caption,
      });
    } else {
      layer.id = resolved.id;
    }
  });
  (group.groups || []).forEach((child) => {
    remapGroupLayerIds(child, resolveId, unmapped);
  });
  return unmapped;
};

export const describeUnmappedLayers = (unmapped) =>
  unmapped
    .map((item) =>
      item.caption
        ? `"${item.caption}" (source id ${item.sourceId})`
        : `source id ${item.sourceId}`,
    )
    .join(", ");

export const stripTempProps = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripTempProps);
  }

  if (value && typeof value === "object") {
    const cleaned = {};
    Object.keys(value).forEach((key) => {
      if (key.indexOf("__") === 0 || key === "childOrder") {
        return;
      }
      cleaned[key] = stripTempProps(value[key]);
    });
    return cleaned;
  }

  return value;
};

export const cloneValue = (value) => JSON.parse(JSON.stringify(value));

export const cloneWithoutTemp = (value) => stripTempProps(cloneValue(value));

export const markSubtreeFlag = (group, flag) => {
  if (!group) {
    return group;
  }
  group[flag] = true;
  (group.layers || []).forEach((layer) => {
    layer[flag] = true;
  });
  (group.groups || []).forEach((child) => markSubtreeFlag(child, flag));
  return group;
};

const relevantLayerKeys = (layer) => {
  const clone = { ...layer };
  Object.keys(clone).forEach((key) => {
    if (key.indexOf("__") === 0 || key === "id") {
      delete clone[key];
    }
  });
  return clone;
};

const GROUP_COMPARE_SKIP = new Set([
  "id",
  "parent",
  "layers",
  "groups",
  "childOrder",
  "type",
]);

const groupMeta = (group) => {
  const meta = {};
  Object.keys(group || {}).forEach((key) => {
    if (key.indexOf("__") === 0 || GROUP_COMPARE_SKIP.has(key)) {
      return;
    }
    meta[key] = group[key];
  });
  return meta;
};

const findSiblingGroup = (siblings, group) =>
  (siblings || []).find((candidate) => candidate.id === group.id) ||
  (siblings || []).find((candidate) => candidate.name === group.name);

const findLayerInGroup = (
  targetGroup,
  sourceLayer,
  resolveLayerId,
  sourceLookup,
  targetLookup,
) => {
  const layers = targetGroup?.layers || [];
  const sameId = layers.find(
    (layer) => String(layer.id) === String(sourceLayer.id),
  );
  if (sameId) {
    return sameId;
  }

  const resolved = resolveLayerId?.(sourceLayer.id);
  if (resolved && !resolved.missing) {
    const byResolved = layers.find(
      (layer) => String(layer.id) === String(resolved.id),
    );
    if (byResolved) {
      return byResolved;
    }
  }

  const sourceTitle = normalizeName(
    getLayerDisplay(sourceLayer.id, sourceLookup).title,
  );
  if (!sourceTitle) {
    return null;
  }
  const byName = layers.filter(
    (layer) =>
      normalizeName(getLayerDisplay(layer.id, targetLookup).title) ===
      sourceTitle,
  );
  return byName.length ? byName[0] : null;
};

export const signaturesEqual = (a, b) =>
  JSON.stringify(a) === JSON.stringify(b);

export const findGroup = (groups, id) => {
  if (!id || !Array.isArray(groups)) {
    return null;
  }

  for (const group of groups) {
    if (group.id === id) {
      return group;
    }
    const nested = findGroup(group.groups, id);
    if (nested) {
      return nested;
    }
  }

  return null;
};

export const findLayer = (groups, id) => {
  if (!id || !Array.isArray(groups)) {
    return null;
  }

  for (const group of groups) {
    const layers = group.layers || [];
    const index = layers.findIndex((layer) => layer.id === id);
    if (index > -1) {
      return { layer: layers[index], group, index };
    }
    const nested = findLayer(group.groups, id);
    if (nested) {
      return nested;
    }
  }

  return null;
};

export const findBaselayer = (options, id) => {
  const list = options?.baselayers || [];
  const index = list.findIndex((layer) => layer.id === id);
  if (index === -1) {
    return null;
  }
  return { layer: list[index], index };
};

export const collectLayerIds = (groups, into = new Set()) => {
  (groups || []).forEach((group) => {
    (group.layers || []).forEach((layer) => into.add(layer.id));
    collectLayerIds(group.groups, into);
  });
  return into;
};

export const collectGroupIds = (groups, into = new Set()) => {
  (groups || []).forEach((group) => {
    into.add(group.id);
    collectGroupIds(group.groups, into);
  });
  return into;
};

export const collectSubtreeIds = (group) => {
  const groupIds = new Set();
  const layerIds = new Set();

  const walk = (node) => {
    if (!node) {
      return;
    }
    groupIds.add(node.id);
    (node.layers || []).forEach((layer) => layerIds.add(layer.id));
    (node.groups || []).forEach(walk);
  };

  walk(group);
  return { groupIds, layerIds };
};

const siblingGroups = (options, parentId) => {
  if (parentId === "-1") {
    return options.groups || [];
  }
  return findGroup(options.groups, parentId)?.groups || [];
};

export const removeGroup = (groups, id) => {
  if (!Array.isArray(groups)) {
    return false;
  }

  const index = groups.findIndex((group) => group.id === id);
  if (index > -1) {
    groups.splice(index, 1);
    return true;
  }

  return groups.some((group) => removeGroup(group.groups || [], id));
};

export const removeLayer = (groups, id) => {
  if (!Array.isArray(groups)) {
    return false;
  }

  for (const group of groups) {
    const layers = group.layers || [];
    const index = layers.findIndex((layer) => layer.id === id);
    if (index > -1) {
      layers.splice(index, 1);
      return true;
    }
    if (removeLayer(group.groups || [], id)) {
      return true;
    }
  }

  return false;
};

const insertAt = (list, item, index) => {
  if (typeof index === "number" && index >= 0 && index <= list.length) {
    list.splice(index, 0, item);
    return;
  }
  list.push(item);
};

export const insertGroup = (options, parentId, group, index) => {
  const nextParentId = parentId || "-1";
  group.parent = nextParentId;
  delete group.childOrder;

  if (nextParentId === "-1") {
    options.groups = options.groups || [];
    insertAt(options.groups, group, index);
    return true;
  }

  const parent = findGroup(options.groups, nextParentId);
  if (!parent) {
    return false;
  }

  parent.groups = parent.groups || [];
  delete parent.childOrder;
  insertAt(parent.groups, group, index);
  return true;
};

export const insertLayer = (options, parentId, layer, index) => {
  const parent = findGroup(options.groups, parentId);
  if (!parent) {
    return false;
  }

  parent.layers = parent.layers || [];
  delete parent.childOrder;
  insertAt(parent.layers, layer, index);
  return true;
};

const siblingIndex = (list, id) => {
  if (!Array.isArray(list)) {
    return undefined;
  }
  const index = list.findIndex((item) => item.id === id);
  return index === -1 ? undefined : index;
};

export const sourceGroupIndex = (sourceOptions, group) =>
  siblingIndex(siblingGroups(sourceOptions, group.parent || "-1"), group.id);

export const sourceLayerIndex = (sourceOptions, parentId, layerId) => {
  const parent = findGroup(sourceOptions.groups, parentId);
  return siblingIndex(parent?.layers, layerId);
};

export const ensureAncestors = (targetOptions, sourceOptions, parentId) => {
  if (!parentId || parentId === "-1" || parentId === BASELAYERS_ID) {
    return true;
  }

  if (findGroup(targetOptions.groups, parentId)) {
    return true;
  }

  const sourceGroup = findGroup(sourceOptions.groups, parentId);
  if (!sourceGroup) {
    return false;
  }

  if (!ensureAncestors(targetOptions, sourceOptions, sourceGroup.parent)) {
    return false;
  }

  const shell = cloneWithoutTemp(sourceGroup);
  shell.layers = [];
  shell.groups = [];
  return insertGroup(
    targetOptions,
    sourceGroup.parent || "-1",
    shell,
    sourceGroupIndex(sourceOptions, sourceGroup),
  );
};

const retargetReplacedGroup = (clone, targetGroup) => {
  const oldId = clone.id;
  clone.id = targetGroup.id;
  clone.parent = targetGroup.parent;
  (clone.groups || []).forEach((child) => {
    if (child.parent === oldId) {
      child.parent = clone.id;
    }
  });
  return clone;
};

export const replaceGroup = (options, targetId, sourceGroup) => {
  const replaceIn = (groups) => {
    const index = (groups || []).findIndex((group) => group.id === targetId);
    if (index > -1) {
      const clone = retargetReplacedGroup(
        cloneWithoutTemp(sourceGroup),
        groups[index],
      );
      clone.__is_replaced = true;
      markSubtreeFlag(clone, "__is_replaced");
      groups[index] = clone;
      return true;
    }

    return (groups || []).some((group) => replaceIn(group.groups || []));
  };

  return replaceIn(options.groups || []);
};

export const replaceLayer = (options, targetId, sourceLayer, extras = {}) => {
  const found = findLayer(options.groups, targetId);
  if (!found) {
    return false;
  }

  const clone = cloneWithoutTemp(sourceLayer);
  clone.id = found.layer.id;
  if (extras.keepDrawOrder) {
    clone.drawOrder = found.layer.drawOrder;
  }
  clone.__is_replaced = true;
  found.group.layers[found.index] = clone;
  return true;
};

export const replaceBaselayer = (options, targetId, sourceLayer, extras = {}) => {
  const found = findBaselayer(options, targetId);
  if (!found) {
    return false;
  }

  const clone = cloneWithoutTemp(sourceLayer);
  clone.id = found.layer.id;
  if (extras.keepDrawOrder) {
    clone.drawOrder = found.layer.drawOrder;
  }
  clone.__is_replaced = true;
  options.baselayers[found.index] = clone;
  return true;
};

export const layerIdsInSubtree = (group) => collectLayerIds([group]);

export const layerIdsOutsideGroup = (options, groupId) => {
  const ids = collectLayerIds(options.groups);
  const group = findGroup(options.groups, groupId);
  if (group) {
    layerIdsInSubtree(group).forEach((id) => ids.delete(id));
  }
  return ids;
};

const decorateLayer = (layer, targetHit, parentChanged) => {
  if (!targetHit) {
    layer.__possible_new = true;
    return;
  }

  if (
    parentChanged ||
    !signaturesEqual(relevantLayerKeys(layer), relevantLayerKeys(targetHit))
  ) {
    layer.__possible_change = true;
    targetHit.__possible_change = true;
  }
};

const decorateGroups = (
  groups,
  targetSiblings,
  targetOptions,
  matchOptions,
) => {
  (groups || []).forEach((group) => {
    const targetGroup = findSiblingGroup(targetSiblings, group);
    if (targetGroup) {
      const sourceMeta = {
        ...groupMeta(group),
        layerNames: (group.layers || []).map(
          (layer) => getLayerDisplay(layer.id, matchOptions.sourceLookup).title,
        ),
      };
      const targetMeta = {
        ...groupMeta(targetGroup),
        layerNames: (targetGroup.layers || []).map(
          (layer) => getLayerDisplay(layer.id, matchOptions.targetLookup).title,
        ),
      };
      if (!signaturesEqual(sourceMeta, targetMeta)) {
        group.__possible_change = true;
        targetGroup.__possible_change = true;
      }
    } else {
      group.__possible_new = true;
    }

    (group.layers || []).forEach((layer) => {
      const inMatchedGroup = findLayerInGroup(
        targetGroup,
        layer,
        matchOptions.resolveLayerId,
        matchOptions.sourceLookup,
        matchOptions.targetLookup,
      );
      if (inMatchedGroup) {
        decorateLayer(layer, inMatchedGroup, false);
        return;
      }

      const resolved = matchOptions.resolveLayerId?.(layer.id);
      const elsewhere =
        (resolved && !resolved.missing
          ? findLayer(targetOptions.groups, resolved.id)
          : null) || findLayer(targetOptions.groups, layer.id);
      decorateLayer(layer, elsewhere?.layer, Boolean(elsewhere));
    });

    decorateGroups(
      group.groups,
      targetGroup?.groups || [],
      targetOptions,
      matchOptions,
    );
  });
};

export const decorateSourceOptions = (
  sourceOptions,
  targetOptions,
  matchOptions = {},
) => {
  if (!sourceOptions || !targetOptions) {
    return sourceOptions;
  }

  decorateGroups(
    sourceOptions.groups,
    targetOptions.groups || [],
    targetOptions,
    {
      resolveLayerId: matchOptions.resolveLayerId,
      sourceLookup: matchOptions.sourceLookup || {},
      targetLookup: matchOptions.targetLookup || {},
    },
  );

  (sourceOptions.baselayers || []).forEach((layer) => {
    const targetHit = findBaselayer(targetOptions, layer.id);
    if (targetHit) {
      decorateLayer(layer, targetHit.layer, false);
      return;
    }
    const resolved = matchOptions.resolveLayerId?.(layer.id);
    const byResolved =
      resolved && !resolved.missing
        ? findBaselayer(targetOptions, resolved.id)
        : null;
    decorateLayer(layer, byResolved?.layer, false);
  });

  return sourceOptions;
};

export const nodeHasFlag = (node) =>
  Boolean(node && Object.keys(node).some((key) => key.indexOf("__") === 0));

export const groupHasFlaggedDescendant = (group) => {
  if (nodeHasFlag(group)) {
    return true;
  }

  if ((group.layers || []).some(nodeHasFlag)) {
    return true;
  }

  return (group.groups || []).some(groupHasFlaggedDescendant);
};

export const matchesTextFilter = (text, ...values) => {
  const needle = (text || "").trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return values.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(needle),
  );
};

const layerSearchValues = (layer, lookup) => {
  const info = getLayerDisplay(layer.id, lookup);
  return [
    layer.id,
    layer.infobox,
    info.title,
    info.internalLayerName,
    info.type,
  ];
};

export const filterGroupTree = (groups, { textFilter, onlyFlags, lookup }) => {
  const needle = (textFilter || "").trim().toLowerCase();

  const keepGroup = (group, ancestorMatched = false) => {
    const selfMatches =
      ancestorMatched ||
      matchesTextFilter(
        needle,
        group.name,
        group.id,
        group.infogrouptitle,
        group.infogrouptext,
      );

    const layers = (group.layers || []).filter((layer) => {
      const textHit =
        selfMatches ||
        matchesTextFilter(needle, ...layerSearchValues(layer, lookup));
      const flagHit = !onlyFlags || nodeHasFlag(layer);
      return textHit && flagHit;
    });

    const nested = (group.groups || [])
      .map((child) => keepGroup(child, selfMatches && Boolean(needle)))
      .filter(Boolean);

    const hasVisibleChild = layers.length > 0 || nested.length > 0;
    const flagOk = !onlyFlags || nodeHasFlag(group) || hasVisibleChild;

    if (!flagOk) {
      return null;
    }

    if (needle && !selfMatches && !hasVisibleChild) {
      return null;
    }

    return {
      ...group,
      layers,
      groups: nested,
    };
  };

  return (groups || []).map((group) => keepGroup(group)).filter(Boolean);
};

export const filterBaselayers = (layers, { textFilter, onlyFlags, lookup }) =>
  (layers || []).filter((layer) => {
    const textHit = matchesTextFilter(
      textFilter,
      ...layerSearchValues(layer, lookup),
    );
    const flagHit = !onlyFlags || nodeHasFlag(layer);
    return textHit && flagHit;
  });

export const resolveLiveSelection = (options, selection) => {
  if (!options || !selection?.node) {
    return selection;
  }

  if (selection.kind === "group") {
    const node = findGroup(options.groups, selection.node.id);
    return node
      ? { ...selection, node, parentId: node.parent || "-1" }
      : selection;
  }

  if (selection.kind === "layer") {
    const found = findLayer(options.groups, selection.node.id);
    return found
      ? { ...selection, node: found.layer, parentId: found.group.id }
      : selection;
  }

  if (selection.kind === "baselayer") {
    const found = findBaselayer(options, selection.node.id);
    return found ? { ...selection, node: found.layer } : selection;
  }

  return selection;
};

export const getSelectionLabel = (selection, lookup) => {
  if (!selection?.node) {
    return "";
  }

  if (selection.kind === "group" || selection.kind === "baselayers") {
    return selection.node.name || selection.node.id;
  }

  return getLayerDisplay(selection.node.id, lookup).title;
};

export const countFlaggedNodes = (options) => {
  let count = 0;

  const walk = (groups) => {
    (groups || []).forEach((group) => {
      if (nodeHasFlag(group)) {
        count += 1;
      }
      (group.layers || []).forEach((layer) => {
        if (nodeHasFlag(layer)) {
          count += 1;
        }
      });
      walk(group.groups);
    });
  };

  walk(options?.groups);
  (options?.baselayers || []).forEach((layer) => {
    if (nodeHasFlag(layer)) {
      count += 1;
    }
  });

  return count;
};

export const copyHajkNodeIntoTarget = ({
  targetOptions,
  kind,
  node,
  destParentId,
  destIndex,
  resolveCopiedLayerId,
}) => {
  if (!targetOptions || !node) {
    return { ok: false, error: "Nothing to copy." };
  }

  if (kind === "group") {
    if (destParentId === BASELAYERS_ID) {
      return { ok: false, error: "Groups cannot be dropped onto Baselayers." };
    }
    if (findGroup(targetOptions.groups, node.id)) {
      return {
        ok: false,
        error:
          "This group already exists in the target. Move it in the target tree instead.",
      };
    }

    const clone = cloneWithoutTemp(node);
    const unmapped = remapGroupLayerIds(clone, resolveCopiedLayerId);
    if (unmapped.length) {
      return {
        ok: false,
        error:
          "Could not match these layers to the target layers file. Copy each layer definition first in Layer files: " +
          describeUnmappedLayers(unmapped),
      };
    }

    const duplicates = [...layerIdsInSubtree(clone)].filter((layerId) =>
      findLayer(targetOptions.groups, layerId),
    );
    if (duplicates.length) {
      return {
        ok: false,
        error: `Cannot copy this group. These layers already exist in the target: ${duplicates.join(
          ", ",
        )}`,
      };
    }

    markSubtreeFlag(clone, "__is_added");
    if (!insertGroup(targetOptions, destParentId || "-1", clone, destIndex)) {
      return { ok: false, error: "Could not drop the group onto that target." };
    }
    return { ok: true };
  }

  if (kind === "layer") {
    if (
      !destParentId ||
      destParentId === "-1" ||
      destParentId === BASELAYERS_ID
    ) {
      return { ok: false, error: "Drop a layer onto a group." };
    }
    const resolved = resolveCopiedLayerId(node.id);
    if (resolved.missing) {
      return {
        ok: false,
        error: `Could not match this layer to the target layers file. Copy the layer definition first in Layer files. ${describeUnmappedLayers(
          [{ sourceId: node.id, caption: resolved.caption }],
        )}`,
      };
    }
    if (findLayer(targetOptions.groups, resolved.id)) {
      return {
        ok: false,
        error:
          "This layer already exists in the target. Drag it in the target tree to move it.",
      };
    }
    const clone = cloneWithoutTemp(node);
    clone.id = resolved.id;
    clone.__is_added = true;
    if (!insertLayer(targetOptions, destParentId, clone, destIndex)) {
      return { ok: false, error: "Drop a layer onto an existing group." };
    }
    return { ok: true };
  }

  if (kind === "baselayer") {
    const resolved = resolveCopiedLayerId(node.id);
    if (resolved.missing) {
      return {
        ok: false,
        error: `Could not match this baselayer to the target layers file. Copy the layer definition first in Layer files. ${describeUnmappedLayers(
          [{ sourceId: node.id, caption: resolved.caption }],
        )}`,
      };
    }
    if (findBaselayer(targetOptions, resolved.id)) {
      return {
        ok: false,
        error:
          "This baselayer already exists in the target. Drag it in the target tree to move it.",
      };
    }
    targetOptions.baselayers = targetOptions.baselayers || [];
    const clone = cloneWithoutTemp(node);
    clone.id = resolved.id;
    clone.__is_added = true;
    insertAt(targetOptions.baselayers, clone, destIndex);
    return { ok: true };
  }

  return { ok: false, error: "That item cannot be copied." };
};

export const replaceSwitcherFromSource = (
  targetOptions,
  sourceOptions,
  resolveCopiedLayerId,
) => {
  if (!targetOptions || !sourceOptions) {
    return {
      ok: false,
      error: "Open both source and target map configs first.",
    };
  }

  const groups = cloneWithoutTemp(sourceOptions.groups || []);
  const baselayers = cloneWithoutTemp(sourceOptions.baselayers || []);
  const unmapped = [];

  groups.forEach((group) => {
    remapGroupLayerIds(group, resolveCopiedLayerId, unmapped);
  });

  baselayers.forEach((layer) => {
    const resolved = resolveCopiedLayerId(layer.id);
    if (resolved.missing) {
      unmapped.push({
        sourceId: layer.id,
        caption: resolved.caption,
      });
    } else {
      layer.id = resolved.id;
    }
  });

  if (unmapped.length) {
    return {
      ok: false,
      error:
        "Could not match these layers to the target layers file. Copy missing layer definitions in Layer files first: " +
        describeUnmappedLayers(unmapped),
    };
  }

  groups.forEach((group) => markSubtreeFlag(group, "__is_replaced"));
  baselayers.forEach((layer) => {
    layer.__is_replaced = true;
  });

  targetOptions.groups = groups;
  targetOptions.baselayers = baselayers;
  return { ok: true };
};
