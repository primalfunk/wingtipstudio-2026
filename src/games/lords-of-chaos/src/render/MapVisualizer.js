function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function intensity(color, light) {
  const factor = light / 5;
  return color.map((channel) => Math.floor(channel * factor));
}

export class MapVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.regionColors = new Map();
    this.tick = 0;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.canvas.width = Math.floor(rect.width * devicePixelRatio);
    this.canvas.height = Math.floor(rect.height * devicePixelRatio);
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  colorForRegion(region, regions) {
    if (!this.regionColors.has(region)) {
      const index = regions.indexOf(region);
      const hue = 80 + (index / Math.max(1, regions.length)) * 220;
      this.regionColors.set(region, hslToRgb(hue, 0.5, 0.48));
    }
    return this.regionColors.get(region);
  }

  draw(game) {
    const ctx = this.ctx;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    if (this.canvas.width !== Math.floor(width * devicePixelRatio) || this.canvas.height !== Math.floor(height * devicePixelRatio)) {
      this.resize();
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#050606";
    ctx.fillRect(0, 0, width, height);
    if (!game) return;

    this.tick = (this.tick + 1) % 60;
    const size = game.gameMap.size;
    const padding = 14;
    const connection = Math.max(3, Math.floor((Math.min(width, height) - padding * 2) / (size * 4)));
    const cell = Math.max(5, Math.floor((Math.min(width, height) - padding * 2 - connection * (size - 1)) / size));
    const step = cell + connection;
    const offsetX = Math.floor((width - (size * cell + (size - 1) * connection)) / 2);
    const offsetY = Math.floor((height - (size * cell + (size - 1) * connection)) / 2);
    const regions = [...new Set([...game.gameMap.rooms.values()].map((room) => room.region))];
    const enemyPositions = new Set(game.enemyManager.enemies.map((enemy) => `${enemy.x},${enemy.y}`));

    for (const room of game.gameMap.rooms.values()) {
      const x = offsetX + room.x * step;
      const y = offsetY + room.y * step;
      let color = [0, 0, 0];
      if (room.lit > 0) {
        color = intensity(this.colorForRegion(room.region, regions), room.lit);
        if (enemyPositions.has(`${room.x},${room.y}`)) color = intensity([255, 35, 35], room.lit);
        if (room.decorations.length && Object.values(room.connections).filter(Boolean).length === 1) color = intensity([170, 150, 0], room.lit);
      }
      const isPlayer = room === game.player.currentRoom;
      const isObjective = game.player.gotRelic && room.isTarget;
      if (isObjective) color = this.tick < 30 ? [0, 210, 70] : [240, 220, 0];
      if (isPlayer) color = [35, 75, 230];
      ctx.fillStyle = `rgb(${color.join(",")})`;
      ctx.fillRect(x, y, cell, cell);
      if (room.lit > 0 || game.allConnectionsVisible) {
        ctx.fillStyle = `rgba(210,255,210,${room.lit > 0 ? 0.26 : 0.12})`;
        ctx.fillRect(x + cell * 0.18, y + cell * 0.18, cell * 0.64, cell * 0.64);
        for (const [direction, connected] of Object.entries(room.connections)) {
          if (!connected) continue;
          if (!game.allConnectionsVisible && connected.lit <= 0) continue;
          ctx.fillStyle = `rgb(${color.join(",")})`;
          if (direction === "e") ctx.fillRect(x + cell, y + cell * 0.35, connection, cell * 0.3);
          if (direction === "s") ctx.fillRect(x + cell * 0.35, y + cell, cell * 0.3, connection);
        }
      }
      if (enemyPositions.has(`${room.x},${room.y}`) && room.lit > 0) {
        ctx.strokeStyle = "#ff4d4d";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, Math.max(2, cell - 4), Math.max(2, cell - 4));
      }
      if (isObjective) {
        ctx.strokeStyle = "#fff36a";
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 2, y - 2, cell + 4, cell + 4);
      }
      if (isPlayer) {
        const pulse = 0.45 + Math.sin(this.tick / 60 * Math.PI * 2) * 0.25;
        ctx.shadowColor = "#7dff7d";
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(190, 255, 190, ${pulse + 0.45})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 3, y - 3, cell + 6, cell + 6);
        ctx.shadowBlur = 0;
      }
    }
    ctx.strokeStyle = "#90ee90";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, width - 16, height - 16);
  }
}
