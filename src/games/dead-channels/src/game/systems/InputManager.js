const SPECIAL_KEYS = new Set(['Enter', 'Escape', 'Backspace', 'Delete', 'F3', 'Tab', 'ArrowUp', 'ArrowDown']);

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.characterHandlers = new Set();
    this.specialHandlers = new Map();
    this.handleKeyDown = this.handleKeyDown.bind(this);

    scene.input.keyboard.addCapture(['ENTER', 'ESC', 'BACKSPACE', 'DELETE', 'F3', 'TAB', 'UP', 'DOWN']);
    scene.input.keyboard.on('keydown', this.handleKeyDown);
    scene.events.once('shutdown', () => this.destroy());
  }

  onTypedCharacter(handler) {
    this.characterHandlers.add(handler);
    return () => this.characterHandlers.delete(handler);
  }

  onSpecialKey(key, handler) {
    if (!this.specialHandlers.has(key)) {
      this.specialHandlers.set(key, new Set());
    }

    this.specialHandlers.get(key).add(handler);
    return () => this.specialHandlers.get(key)?.delete(handler);
  }

  handleKeyDown(event) {
    if (SPECIAL_KEYS.has(event.key)) {
      event.preventDefault();
      this.emitSpecial(event.key, event);
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.characterHandlers.forEach((handler) => handler(event.key, event));
    }
  }

  emitSpecial(key, event) {
    this.specialHandlers.get(key)?.forEach((handler) => handler(event));
  }

  destroy() {
    if (!this.scene?.input?.keyboard) {
      return;
    }

    this.scene.input.keyboard.off('keydown', this.handleKeyDown);
    this.characterHandlers.clear();
    this.specialHandlers.clear();
  }
}
