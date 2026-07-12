const STORAGE_KEY = "ancientSuffering.paneLayout.v1";
const MIN_LEFT = 180;
const MAX_LEFT = 520;
const MIN_RIGHT = 200;
const MAX_RIGHT = 560;
const MIN_DASHBOARD_WIDTH = 900;
const MIN_CONTROL_HEIGHT = 130;
const MAX_CONTROL_HEIGHT = 420;
const MIN_CONTROL_GROUP = 120;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setPaneWidth(name, value) {
  document.documentElement.style.setProperty(`--${name}-pane-width`, `${value}px`);
}

function setDashboardWidth(value) {
  document.documentElement.style.setProperty("--dashboard-width", `${value}px`);
}

function setControlHeight(value) {
  document.documentElement.style.setProperty("--control-panel-height", `${value}px`);
}

function setControlWidths(widths) {
  Object.entries(widths).forEach(([name, value]) => {
    document.documentElement.style.setProperty(`--${name}-control-width`, `${value}px`);
  });
}

function readLayout() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Layout persistence is optional.
  }
}

export function initializePaneResizers() {
  const dashboard = document.getElementById("dashboard");
  const leftOuterResizer = document.getElementById("left-outer-resizer");
  const rightOuterResizer = document.getElementById("right-outer-resizer");
  const leftResizer = document.getElementById("left-pane-resizer");
  const rightResizer = document.getElementById("right-pane-resizer");
  const narrativePanel = document.getElementById("narrative-panel");
  const controlPanel = document.getElementById("control-panel");
  const controlTopResizer = document.getElementById("control-top-resizer");
  const navSceneResizer = document.getElementById("nav-scene-resizer");
  const sceneCharacterResizer = document.getElementById("scene-character-resizer");
  const characterSystemResizer = document.getElementById("character-system-resizer");
  if (!dashboard || !leftResizer || !rightResizer) return;

  const savedLayout = readLayout();
  if (savedLayout.dashboardWidth) setDashboardWidth(clamp(savedLayout.dashboardWidth, MIN_DASHBOARD_WIDTH, window.innerWidth - 32));
  if (savedLayout.left) setPaneWidth("left", clamp(savedLayout.left, MIN_LEFT, MAX_LEFT));
  if (savedLayout.right) setPaneWidth("right", clamp(savedLayout.right, MIN_RIGHT, MAX_RIGHT));
  if (savedLayout.controlHeight) setControlHeight(clamp(savedLayout.controlHeight, MIN_CONTROL_HEIGHT, MAX_CONTROL_HEIGHT));
  if (savedLayout.controlWidths) setControlWidths(savedLayout.controlWidths);

  function startDrag(side, event) {
    event.preventDefault();
    const startX = event.clientX;
    const layout = readLayout();
    const dashboardRect = dashboard.getBoundingClientRect();
    const startLeft = layout.left || dashboard.querySelector("#location-panel").getBoundingClientRect().width;
    const startRight = layout.right || dashboard.querySelector("#character-panel").getBoundingClientRect().width;

    function onPointerMove(moveEvent) {
      if (side === "left") {
        const nextLeft = clamp(startLeft + moveEvent.clientX - startX, MIN_LEFT, Math.min(MAX_LEFT, dashboardRect.width - 520));
        setPaneWidth("left", nextLeft);
        writeLayout({ ...readLayout(), left: nextLeft });
      } else {
        const nextRight = clamp(startRight + startX - moveEvent.clientX, MIN_RIGHT, Math.min(MAX_RIGHT, dashboardRect.width - 520));
        setPaneWidth("right", nextRight);
        writeLayout({ ...readLayout(), right: nextRight });
      }
    }

    function onPointerUp() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.classList.remove("resizing-pane");
    }

    document.body.classList.add("resizing-pane");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  leftResizer.addEventListener("pointerdown", event => startDrag("left", event));
  rightResizer.addEventListener("pointerdown", event => startDrag("right", event));

  function startDashboardWidthDrag(side, event) {
    event.preventDefault();
    const startX = event.clientX;
    const layout = readLayout();
    const startWidth = layout.dashboardWidth || dashboard.getBoundingClientRect().width;
    const maxWidth = window.innerWidth - 32;

    function onPointerMove(moveEvent) {
      const delta = side === "left" ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      const nextWidth = clamp(startWidth + delta, MIN_DASHBOARD_WIDTH, maxWidth);
      setDashboardWidth(nextWidth);
      writeLayout({ ...readLayout(), dashboardWidth: nextWidth });
    }

    function onPointerUp() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.classList.remove("resizing-pane");
    }

    document.body.classList.add("resizing-pane");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  leftOuterResizer?.addEventListener("pointerdown", event => startDashboardWidthDrag("left", event));
  rightOuterResizer?.addEventListener("pointerdown", event => startDashboardWidthDrag("right", event));

  function startControlHeightDrag(event) {
    if (!narrativePanel || !controlPanel) return;
    event.preventDefault();
    const startY = event.clientY;
    const layout = readLayout();
    const startHeight = layout.controlHeight || controlPanel.getBoundingClientRect().height;
    const maxHeight = Math.min(MAX_CONTROL_HEIGHT, narrativePanel.getBoundingClientRect().height - 180);

    function onPointerMove(moveEvent) {
      const nextHeight = clamp(startHeight + startY - moveEvent.clientY, MIN_CONTROL_HEIGHT, maxHeight);
      setControlHeight(nextHeight);
      writeLayout({ ...readLayout(), controlHeight: nextHeight });
    }

    function onPointerUp() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.classList.remove("resizing-pane");
    }

    document.body.classList.add("resizing-pane");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  function getControlWidths() {
    const groups = [...controlPanel.querySelectorAll(".control-group")];
    const [nav, scene, character, system] = groups.map(group => group.getBoundingClientRect().width);
    return {
      nav: nav || 180,
      scene: scene || 140,
      character: character || 140,
      system: system || 140
    };
  }

  function startControlWidthDrag(leftName, rightName, event) {
    if (!controlPanel) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidths = readLayout().controlWidths || getControlWidths();
    const total = startWidths[leftName] + startWidths[rightName];

    function onPointerMove(moveEvent) {
      const delta = moveEvent.clientX - startX;
      const nextLeft = clamp(startWidths[leftName] + delta, MIN_CONTROL_GROUP, total - MIN_CONTROL_GROUP);
      const nextRight = total - nextLeft;
      const nextWidths = {
        ...startWidths,
        [leftName]: nextLeft,
        [rightName]: nextRight
      };
      setControlWidths(nextWidths);
      writeLayout({ ...readLayout(), controlWidths: nextWidths });
    }

    function onPointerUp() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.classList.remove("resizing-pane");
    }

    document.body.classList.add("resizing-pane");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  controlTopResizer?.addEventListener("pointerdown", startControlHeightDrag);
  navSceneResizer?.addEventListener("pointerdown", event => startControlWidthDrag("nav", "scene", event));
  sceneCharacterResizer?.addEventListener("pointerdown", event => startControlWidthDrag("scene", "character", event));
  characterSystemResizer?.addEventListener("pointerdown", event => startControlWidthDrag("character", "system", event));
}
