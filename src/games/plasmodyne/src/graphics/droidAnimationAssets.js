export const DROID_ANIMATION = {
  frameWidth: 512,
  frameHeight: 512,
  frameCount: 24,
  frameRate: 12,
  seriesCount: 10
};

export const DROID_EXPLOSION = {
  spritesheetKey: 'droid-explosion-sheet',
  animationKey: 'droid-explosion',
  frameWidth: 128,
  frameHeight: 128,
  frameCount: 20,
  frameRate: 24,
  peakFrame: 6,
  displaySize: 176
};

export function getDroidSeriesForRank(rank = 0) {
  return Math.max(0, Math.min(9, Math.floor(Number(rank) / 100)));
}

export function getDroidSpritesheetKey(series) {
  return `droid-series-${series}-sheet`;
}

export function getDroidAnimationKey(series) {
  return `droid-series-${series}-spin`;
}

export function preloadDroidSpritesheets(scene) {
  for (let series = 0; series < DROID_ANIMATION.seriesCount; series += 1) {
    scene.load.spritesheet(getDroidSpritesheetKey(series), `./assets/droids/series_${series}/spritesheet.png`, {
      frameWidth: DROID_ANIMATION.frameWidth,
      frameHeight: DROID_ANIMATION.frameHeight,
      endFrame: DROID_ANIMATION.frameCount - 1
    });
  }
  scene.load.spritesheet(DROID_EXPLOSION.spritesheetKey, './assets/effects/droid_explosion.png', {
    frameWidth: DROID_EXPLOSION.frameWidth,
    frameHeight: DROID_EXPLOSION.frameHeight,
    endFrame: DROID_EXPLOSION.frameCount - 1
  });
}

export function createDroidSeriesAnimations(scene) {
  for (let series = 0; series < DROID_ANIMATION.seriesCount; series += 1) {
    const animationKey = getDroidAnimationKey(series);
    if (scene.anims.exists(animationKey)) {
      continue;
    }

    scene.anims.create({
      key: animationKey,
      frames: scene.anims.generateFrameNumbers(getDroidSpritesheetKey(series), {
        start: 0,
        end: DROID_ANIMATION.frameCount - 1
      }),
      frameRate: DROID_ANIMATION.frameRate,
      repeat: -1
    });
  }

  if (!scene.anims.exists(DROID_EXPLOSION.animationKey)) {
    scene.anims.create({
      key: DROID_EXPLOSION.animationKey,
      frames: scene.anims.generateFrameNumbers(DROID_EXPLOSION.spritesheetKey, {
        start: 0,
        end: DROID_EXPLOSION.frameCount - 1
      }),
      frameRate: DROID_EXPLOSION.frameRate,
      repeat: 0
    });
  }
}

export function getDroidVisualKeys(rank) {
  const series = getDroidSeriesForRank(rank);
  return {
    series,
    textureKey: getDroidSpritesheetKey(series),
    animationKey: getDroidAnimationKey(series)
  };
}
