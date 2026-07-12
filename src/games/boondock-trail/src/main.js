import "@fontsource/instrument-serif/latin.css";
import "@fontsource/instrument-serif/latin-italic.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "./styles.css";
import { createApp } from "./app.js";

createApp(document.querySelector("#app"));
window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));
