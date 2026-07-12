import Phaser from 'phaser';

function colorToCss(color) {
  return Phaser.Display.Color.IntegerToColor(color).rgba;
}

export function createDroidTexture(scene, key, options = {}) {
  const radius = options.radius ?? 48;
  const size = radius * 2;
  const canvas = scene.textures.createCanvas(key, size, size);
  const context = canvas.getContext();
  const center = radius;
  const fillColor = options.fillColor ?? 0x102532;
  const strokeColor = options.strokeColor ?? 0xbaf7ff;
  const accentColor = options.accentColor ?? 0xffd36a;
  const idText = options.idText ?? '000';
  const rank = Number(idText) || 0;
  const heavyRank = rank >= 550;
  const commandRank = rank >= 850;

  context.clearRect(0, 0, size, size);

  context.save();
  context.shadowColor = colorToCss(strokeColor);
  context.shadowBlur = 10;

  context.beginPath();
  context.arc(center, center, radius - 4, 0, Math.PI * 2);
  context.fillStyle = colorToCss(fillColor);
  context.fill();
  context.lineWidth = commandRank ? 7 : heavyRank ? 5 : 4;
  context.strokeStyle = colorToCss(strokeColor);
  context.stroke();

  context.shadowBlur = 0;
  context.beginPath();
  context.arc(center, center, radius * 0.66, 0, Math.PI * 2);
  context.lineWidth = heavyRank ? 3 : 2;
  context.strokeStyle = colorToCss(strokeColor);
  context.globalAlpha = 0.75;
  context.stroke();
  context.globalAlpha = 1;

  context.beginPath();
  context.arc(center, center, radius * 0.31, 0, Math.PI * 2);
  context.lineWidth = 1.5;
  context.strokeStyle = colorToCss(accentColor);
  context.stroke();

  if (heavyRank) {
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI / 2 + Math.PI / 4;
      const sx = center + Math.cos(angle) * radius * 0.76;
      const sy = center + Math.sin(angle) * radius * 0.76;
      context.beginPath();
      context.arc(sx, sy, radius * 0.07, 0, Math.PI * 2);
      context.fillStyle = colorToCss(accentColor);
      context.globalAlpha = 0.75;
      context.fill();
      context.globalAlpha = 1;
    }
  }

  if (commandRank) {
    context.beginPath();
    context.rect(center - radius * 0.42, center - radius * 0.42, radius * 0.84, radius * 0.84);
    context.lineWidth = 1.5;
    context.strokeStyle = colorToCss(accentColor);
    context.globalAlpha = 0.7;
    context.stroke();
    context.globalAlpha = 1;
  }

  context.beginPath();
  context.moveTo(center + radius - 15, center);
  context.lineTo(center + radius - 4, center - 7);
  context.lineTo(center + radius - 4, center + 7);
  context.closePath();
  context.fillStyle = colorToCss(accentColor);
  context.fill();

  context.font = `700 ${Math.floor(radius * 0.48)}px Ethnocentric, "Ethnocentric Rg", Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 4;
  context.strokeStyle = '#031018';
  context.strokeText(idText, center, center + 1);
  context.fillStyle = '#ffffff';
  context.fillText(idText, center, center + 1);

  if (options.classGlyph) {
    context.font = `700 ${Math.floor(radius * 0.2)}px Ethnocentric, "Ethnocentric Rg", Arial, sans-serif`;
    context.fillStyle = colorToCss(accentColor);
    context.fillText(options.classGlyph, center, center + radius * 0.43);
  }

  if (options.damaged) {
    context.beginPath();
    context.moveTo(center - radius * 0.3, center - radius * 0.45);
    context.lineTo(center - radius * 0.1, center - radius * 0.1);
    context.lineTo(center - radius * 0.22, center + radius * 0.26);
    context.lineWidth = 2;
    context.strokeStyle = '#ff6f61';
    context.stroke();
  }

  context.restore();
  canvas.refresh();
  return canvas;
}
