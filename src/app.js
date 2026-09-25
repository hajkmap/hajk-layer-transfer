import "@fontsource/roboto";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import * as React from "react";
import * as ReactDOM from "react-dom/client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Box, Tab, Tabs } from "@mui/material";
import global from "./models/Global";

import LayerTransferView from "./views/LayerTransferView";
import MapTransferView from "./views/MapTransferView";

const AppShell = () => {
  const [mode, setMode] = React.useState("layers");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Tabs
        value={mode}
        onChange={(_, value) => setMode(value)}
        sx={{ mb: 2, minHeight: 40, flexShrink: 0 }}
      >
        <Tab value="layers" label="Layer files" />
        <Tab value="maps" label="Map files (layer order)" />
      </Tabs>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {mode === "layers" ? <LayerTransferView /> : <MapTransferView />}
      </Box>
    </Box>
  );
};

global.init().then(() => {
  // Lets run this app.

  global.theme = createTheme({
    palette: {
      mode: "dark", // Lets force dark mode.
    },
    transitions: {
      duration: {
        shortest: 0,
        shorter: 0,
        short: 0,
        standard: 0,
        complex: 0,
        enteringScreen: 0,
        leavingScreen: 0,
      },
      easing: {
        easeInOut: "linear",
        easeOut: "linear",
        easeIn: "linear",
        sharp: "linear",
      },
    },
  });

  const root = ReactDOM.createRoot(document.getElementById("root"));

  root.render(
    <ThemeProvider theme={global.theme}>
      <CssBaseline />
      <AppShell />
    </ThemeProvider>
  );
});
