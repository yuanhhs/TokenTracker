import React from "react";
import { createRoot } from "react-dom/client";
import { FloatingApp } from "./FloatingApp.jsx";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "./floating.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><FloatingApp /></React.StrictMode>,
);
