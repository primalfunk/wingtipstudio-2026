export default class TypewriterTextRenderer {
  constructor(scene, textObject, lines, config = {}) {
    this.scene = scene;
    this.textObject = textObject;
    this.fullText = lines.join('\n');
    this.delayMs = config.delayMs ?? 18;
    this.tick = config.tick ?? null;
    this.index = 0;
    this.complete = false;
    this.timer = null;
  }

  start() {
    this.textObject.setText('');
    this.scheduleNextCharacter();
  }

  skip() {
    if (this.complete) {
      return;
    }

    this.timer?.remove(false);
    this.textObject.setText(this.fullText);
    this.complete = true;
  }

  destroy() {
    this.timer?.remove(false);
  }

  scheduleNextCharacter() {
    this.timer = this.scene.time.delayedCall(this.delayMs, () => {
      this.index += 1;
      this.textObject.setText(this.fullText.slice(0, this.index));
      if (this.fullText[this.index - 1] && this.fullText[this.index - 1] !== ' ' && this.fullText[this.index - 1] !== '\n') {
        this.tick?.(this.index);
      }

      if (this.index >= this.fullText.length) {
        this.complete = true;
        return;
      }

      this.scheduleNextCharacter();
    });
  }
}
