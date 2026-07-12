import { UI_THEME } from '../UiTheme.js';

export function drawTutorialIcon(graphics, id, x, y, size = 28) {
  const c = UI_THEME.primaryAccent;
  const a = UI_THEME.warningAccent;
  graphics.lineStyle(2, c, 0.9);
  graphics.fillStyle(0x061018, 0.86);

  if (id === 'wasd') {
    drawKey(graphics, x, y - size * 0.32, size * 0.34, 'W');
    drawKey(graphics, x - size * 0.38, y + size * 0.08, size * 0.34, 'A');
    drawKey(graphics, x, y + size * 0.08, size * 0.34, 'S');
    drawKey(graphics, x + size * 0.38, y + size * 0.08, size * 0.34, 'D');
    return;
  }

  if (id === 'arrows') {
    graphics.strokeTriangle(x, y - 13, x - 6, y - 4, x + 6, y - 4);
    graphics.strokeTriangle(x, y + 13, x - 6, y + 4, x + 6, y + 4);
    graphics.strokeTriangle(x - 14, y, x - 4, y - 6, x - 4, y + 6);
    graphics.strokeTriangle(x + 14, y, x + 4, y - 6, x + 4, y + 6);
    return;
  }

  if (id === 'mouse-left' || id === 'mouse-hold' || id === 'mouse-right') {
    graphics.strokeRoundedRect(x - 11, y - 16, 22, 32, 8);
    graphics.lineBetween(x, y - 16, x, y - 2);
    graphics.fillStyle(id === 'mouse-right' ? a : c, id === 'mouse-hold' ? 0.7 : 0.95);
    graphics.fillRoundedRect(x + (id === 'mouse-right' ? 1 : -9), y - 14, 8, 12, 4);
    if (id === 'mouse-hold') {
      graphics.strokeCircle(x, y, 20);
    }
    return;
  }

  if (id === 'laser') {
    graphics.lineStyle(3, a, 0.95);
    graphics.lineBetween(x - 16, y + 8, x + 18, y - 10);
    graphics.fillStyle(a, 0.92);
    graphics.fillCircle(x + 18, y - 10, 3);
    return;
  }

  if (id === 'signal') {
    graphics.strokeCircle(x, y, 5);
    graphics.strokeCircle(x, y, 13);
    graphics.lineBetween(x - 19, y, x + 19, y);
    return;
  }

  if (id === 'droid') {
    graphics.strokeCircle(x, y, 16);
    graphics.lineStyle(2, a, 0.9);
    graphics.lineBetween(x - 13, y, x + 13, y);
    return;
  }

  if (id === 'objective') {
    graphics.lineStyle(2, UI_THEME.dangerAccent, 0.95);
    graphics.strokeCircle(x, y, 15);
    graphics.lineBetween(x - 20, y, x + 20, y);
    graphics.lineBetween(x, y - 20, x, y + 20);
  }
}

function drawKey(graphics, x, y, size) {
  graphics.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 3);
}
