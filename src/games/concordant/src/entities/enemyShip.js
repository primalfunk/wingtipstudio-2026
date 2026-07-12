import { CONFIG } from "../game/config.js";

const { ENEMY } = CONFIG;
const ENEMY_ROT_SPEED = ENEMY.ROT_SPEED;
const ENEMY_THRUST = ENEMY.THRUST;
const ENEMY_MAX_SPEED = ENEMY.MAX_SPEED;
const ENEMY_STRAFE_RANGE = ENEMY.STRAFE_RANGE;
const ENEMY_STRAFE_BUFFER = ENEMY.STRAFE_BUFFER;
const ENEMY_DRAW_SIZE = ENEMY.DRAW_SIZE;
const ENEMY_SPRITE = new Image();
ENEMY_SPRITE.src = ENEMY.SPRITE_SRC;

export class EnemyShip {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = 0;
    this.fireCooldown = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafing = false;
  }

  update(dt, targetX, targetY, shouldChase) {
    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }
    if (!shouldChase) {
      return;
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (this.strafing) {
      if (dist > ENEMY_STRAFE_RANGE + ENEMY_STRAFE_BUFFER) {
        this.strafing = false;
      }
    } else if (dist < ENEMY_STRAFE_RANGE) {
      this.strafing = true;
    }

    let steerX = dx;
    let steerY = dy;
    if (this.strafing) {
      steerX = -dy * this.strafeDir;
      steerY = dx * this.strafeDir;
    }

    // Heading 0 points "up", so use swapped atan2 to match sin/-cos thrust.
    const desired = Math.atan2(steerX, -steerY);
    let delta = desired - this.heading;
    delta = ((delta + Math.PI) % (Math.PI * 2)) - Math.PI;
    const turn = Math.max(-ENEMY_ROT_SPEED * dt, Math.min(ENEMY_ROT_SPEED * dt, delta));
    this.heading += turn;

    const fx = Math.sin(this.heading);
    const fy = -Math.cos(this.heading);
    this.vx += fx * ENEMY_THRUST * dt;
    this.vy += fy * ENEMY_THRUST * dt;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > ENEMY_MAX_SPEED) {
      const scale = ENEMY_MAX_SPEED / speed;
      this.vx *= scale;
      this.vy *= scale;
    }
  }

  canFire() {
    return this.fireCooldown <= 0;
  }

  resetFireCooldown(cooldown) {
    this.fireCooldown = cooldown;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading);
    if (ENEMY_SPRITE.complete && ENEMY_SPRITE.naturalWidth > 0) {
      const scale = ENEMY_DRAW_SIZE / ENEMY_SPRITE.naturalHeight;
      const drawW = ENEMY_SPRITE.naturalWidth * scale;
      const drawH = ENEMY_SPRITE.naturalHeight * scale;
      ctx.drawImage(ENEMY_SPRITE, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(8, 10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 80, 80, 0.9)";
      ctx.fill();
    }
    ctx.restore();
  }
}

