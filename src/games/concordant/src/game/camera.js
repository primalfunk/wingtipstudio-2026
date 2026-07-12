export class Camera {
  constructor(ship) {
    this.ship = ship;
    this.zoom = 1;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  applyTransform(ctx, canvas) {
    ctx.save();
    ctx.translate(canvas.width / 2 + this.shakeX, canvas.height / 2 + this.shakeY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.ship.x, -this.ship.y);
  }

  resetTransform(ctx) {
    ctx.restore();
  }
}

