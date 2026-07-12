export function showShipDestroyedModal(root, _remainingLives, onClose) {
  if (!root) {
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "overlay ship-destroyed-modal";

  const panel = document.createElement("div");
  panel.className = "ship-destroyed-panel";

  const title = document.createElement("div");
  title.className = "ship-destroyed-title";
  title.textContent = "Ship Destroyed";

  const subtitle = document.createElement("div");
  subtitle.className = "ship-destroyed-subtitle";
  subtitle.textContent = "Tap to continue";

  panel.appendChild(title);
  panel.appendChild(subtitle);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  let closed = false;
  let canClose = false;
  const unlockTimer = window.setTimeout(() => {
    canClose = true;
  }, 150);

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    cleanup();
    if (onClose) {
      onClose();
    }
  };

  const onPointerDown = () => {
    if (!canClose) {
      return;
    }
    close();
  };

  overlay.addEventListener("pointerdown", onPointerDown);

  function cleanup() {
    window.clearTimeout(unlockTimer);
    overlay.removeEventListener("pointerdown", onPointerDown);
    overlay.remove();
  }

  return {
    destroy: cleanup,
    close
  };
}
