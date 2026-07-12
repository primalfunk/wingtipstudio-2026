import "./styles.css";
import { initApp } from "./ui/app";

initApp(document);
window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));
