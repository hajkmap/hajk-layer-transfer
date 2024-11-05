import "@fontsource/roboto";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import * as React from "react";
import * as ReactDOM from "react-dom/client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import global from "./models/Global";

import LayerTransferView from "./views/LayerTransferView";

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
        easeInOut: 'linear',
        easeOut: 'linear',
        easeIn: 'linear',
        sharp: 'linear',
      },
    },    
  });

  const root = ReactDOM.createRoot(document.getElementById("root"));

  root.render(
    <ThemeProvider theme={global.theme}>
      <CssBaseline />
      <LayerTransferView />
    </ThemeProvider>
  );
});
