# Hajk layer transfer

This app can be used to simplify the process of copying layers between diffrent layer.json files.

Build using React with MaterialUI, wrapped in Electron to work as a desktop application (UI and filesystem read/write etc).

Note that this is a rapidly built app with alot of missing error handling. Let's call it a working prototype.

It is provided in current state because people have asked for it.

```
npm install
npm run start
```

### Base functionality

- Copy layer from source to target (Creates new ID)
- Replace existing layer in target (Keeps target ID)
- Compare two layers
- Simple sorting and text filtering
- Simple replaceOnSave functionality (configured in config)

### Main UI

![image](https://github.com/hajkmap/hajk-layer-transfer/assets/73874338/7aebfe79-61f8-4420-9d8f-9e23179ee734)

### Simple json comparison feature

![image](https://github.com/hajkmap/hajk-layer-transfer/assets/73874338/cee3309b-ca3b-499e-bdb5-9c7c4ed23f11)

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
