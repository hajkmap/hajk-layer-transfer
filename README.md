# Hajk layer transfer

This app can be used to simplify the process of copying layers between different `layers.json` files, and copying or reordering groups/layers between Hajk layerswitcher map configs.

Build using React with MaterialUI, wrapped in Electron to work as a desktop application (UI and filesystem read/write etc).

Note that this is a rapidly built app with a lot of missing error handling. Let's call it a working prototype.

It is provided in current state because people have asked for it.

```
npm install
npm run start
```

The window has two tabs: **Layer files** and **Map files (layer order)**.

### Layer files

- Copy one or more layers from source to target. Hold Ctrl/Cmd to multi-select. F5 also copies.
- By default a copy gets a new ID (`number` or `uuid` from `app.config.json`).
- **Use source IDs in target (on copy)** keeps the source ID in target. Blocked if that ID already exists in the target.
- Replace writes source fields onto the selected target layer and **keeps the prod ID**. Select the same number of layers on both sides; pairs follow selection order.
- Compare a selected pair in a full JSON diff dialog.
- Delete selected target layers.
- **Undo** (Ctrl/Cmd+Z) rolls back the last copy, replace, or delete on the target. Several steps can be undone. Opening or saving a target file clears undo history.
- **Clear files** unloads both sides so a new pair can be opened.

Layer-list compare colors:

- **Orange** — missing in target (no matching caption/id).
- **Blue** — found on both sides, but fields differ. Source is filled blue; target uses a 1px dashed blue outline.
- **Green** — copied in this session.
- **Dark green** — replaced in this session.

Compare **matches** by `id`, then by `caption`. It then diffs the rest of the layer. `date` is ignored. `version` and other fields are compared. Temporary `__` flags are ignored.

Opening a new source file always starts without leftover compare colors. Colors appear again after a target file is opened. After a successful **Save to file**, copied/replaced greens and missing oranges are reset and the lists are compared again.

### Main UI

![image](https://github.com/hajkmap/hajk-layer-transfer/assets/73874338/7aebfe79-61f8-4420-9d8f-9e23179ee734)

### Simple json comparison feature

![image](https://github.com/hajkmap/hajk-layer-transfer/assets/73874338/cee3309b-ca3b-499e-bdb5-9c7c4ed23f11)

### Map files (layer order)

This tab edits Hajk `layerswitcher` trees (`groups` and `baselayers`). Other map tools and settings are left as they are.

1. Open the layers configs (source and target).
2. Open the map configs (source and target).

Compare colors wait until all four files are open. Layers are matched by name (and session id remaps from Layer files). Groups are matched by name among subgroups of the same parent; group settings are compared except identity (`id`, `parent`, `layers`, `groups`).

- Drag from source onto a target group to copy. Drag inside the target tree to reorder.
- Hajk always draws a group's **layers first, then its subgroups**. A subgroup cannot be dropped above a layer in the same group.
- A **Drop at bottom** zone marks the end of the target list.
- Hovering a group with children draws a dashed box around the whole group.
- Replace a selected group (whole subtree) or a single layer/baselayer. Layer replace keeps the prod layer id.
- **Keep target drawOrder** keeps prod `drawOrder` when replacing a single layer or baselayer.
- **Replace all from source** replaces the whole target layerswitcher tree, remaps layer ids using both layers files, then opens save.
- Copy / delete / undo / clear files work the same way as on the Layer tab (undo also covers drag-copy and reorder).

When you copy a layer definition in Layer files first, the map tab reuses that prod id. If both layers files are open, unmatched layers can still be resolved by caption.

### Base functionality

- Copy layer from source to target (new ID, or keep source ID if the checkbox is on)
- Replace existing layer in target (keeps target ID)
- Compare two layers
- Multi-select, sorting, and text filtering
- Map-tree copy, replace, and reorder with Hajk layer-then-group order
- Undo and clear loaded files
- Simple replaceOnSave functionality (configured in config)

<img width="2085" height="1021" alt="mapconfig" src="https://github.com/user-attachments/assets/64b248e9-247f-4db6-b06a-34219c704c51" />


### New IDs?

How a new ID is generated is configured in _app.config.json_, use `number` if you're using old .net backend and `uuid` if you are using nodejs backend.

```json
{
  "idType_NOTE": "idType supports number or uuid. Use uuid for node backend.",
  "idType": "number",
  "updateCopiesWithNewDateStamp": true,
  "updateReplacesWithNewDateStamp": true,
  "replaceOnSave": {
    "active": true,
    "list": [
      { "from": "wms-utv.", "to": "wms." },
      { "from": "kommungis-utv.", "to": "kommungis." },
      { "from": "\"version\": \"1.3.0\"", "to": "\"version\": \"1.1.1\"" },
      {
        "from": "\"projection\": \"EPSG:3006\"",
        "to": "\"projection\": \"EPSG:3007\""
      }
    ]
  }
}
```
