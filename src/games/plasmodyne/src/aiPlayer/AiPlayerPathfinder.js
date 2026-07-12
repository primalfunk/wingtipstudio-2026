import Phaser from 'phaser';
import { PLAYER } from '../data/constants.js';
import { DroidPathfinder } from '../systems/ai/DroidPathfinder.js';

export class AiPlayerPathfinder {
  constructor(scene) {
    this.scene = scene;
  }

  pathTo(point) {
    const target = this.scene.findNearestPlayablePoint?.(point.x, point.y, PLAYER.collisionRadius ?? PLAYER.radius) ?? point;
    return DroidPathfinder.findPath(this.scene.currentDeck, this.scene.player.sprite, target, {
      avoidLiftPads: false
    });
  }

  nearestReachable(points) {
    let best = null;
    let bestPath = [];
    let bestScore = Infinity;
    for (const point of points) {
      const path = this.pathTo(point);
      if (!path.length) {
        continue;
      }
      const score = path.length + Phaser.Math.Distance.Between(this.scene.player.sprite.x, this.scene.player.sprite.y, point.x, point.y) / 1000;
      if (score < bestScore) {
        best = point;
        bestPath = path;
        bestScore = score;
      }
    }
    return best ? { point: best, path: bestPath } : null;
  }
}
