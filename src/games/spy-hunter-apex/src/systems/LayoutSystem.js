import { DESIGN_HEIGHT, DESIGN_WIDTH, GAME_HEIGHT, GAME_WIDTH, ROAD, setGameSize } from '../data/tuning.js';

const MIN_WIDTH = 320;
const MIN_HEIGHT = 480;

export default class LayoutSystem {
  static updateFromScale(scale) {
    const width = Math.max(MIN_WIDTH, Math.floor(scale.width || DESIGN_WIDTH));
    const height = Math.max(MIN_HEIGHT, Math.floor(scale.height || DESIGN_HEIGHT));
    setGameSize(width, height);
    return LayoutSystem.current();
  }

  static current() {
    const safeMargin = {
      left: 14,
      right: 14,
      top: 14,
      bottom: 14,
    };
    const laneWidth = (ROAD.right - ROAD.left) / ROAD.laneCount;
    return {
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      centerX: GAME_WIDTH / 2,
      centerY: GAME_HEIGHT / 2,
      designWidth: DESIGN_WIDTH,
      designHeight: DESIGN_HEIGHT,
      scaleY: GAME_HEIGHT / DESIGN_HEIGHT,
      safe: {
        left: safeMargin.left,
        right: GAME_WIDTH - safeMargin.right,
        top: safeMargin.top,
        bottom: GAME_HEIGHT - safeMargin.bottom,
      },
      road: {
        left: ROAD.left,
        right: ROAD.right,
        top: ROAD.top,
        bottom: ROAD.bottom,
        width: ROAD.right - ROAD.left,
        laneWidth,
        laneCenters: Array.from({ length: ROAD.laneCount }, (_, index) => ROAD.left + laneWidth * (index + 0.5)),
      },
    };
  }

  static screen(scene = null) {
    if (scene) {
      LayoutSystem.updateFromScale(scene.scale);
    }
    const layout = LayoutSystem.current();
    const isWide = layout.width / layout.height >= 1.25;
    const isNarrow = layout.width / layout.height <= 0.62;
    const marginX = Math.max(20, Math.min(48, layout.width * 0.055));
    const marginTop = Math.max(18, Math.min(44, layout.height * 0.045));
    const bottomBand = Math.max(112, Math.min(150, layout.height * 0.17));
    return {
      ...layout,
      isWide,
      isNarrow,
      marginX,
      marginTop,
      bottomBand,
      contentWidth: layout.width - marginX * 2,
      contentBottom: layout.height - bottomBand,
      titleY: Math.max(76, layout.height * (isNarrow ? 0.2 : 0.24)),
      menuStartY: Math.min(layout.height - 260, Math.max(360, layout.height * 0.56)),
    };
  }

  static onResize(scene, callback) {
    const handler = () => callback(LayoutSystem.updateFromScale(scene.scale));
    scene.scale.on('resize', handler);
    scene.events.once('shutdown', () => scene.scale.off('resize', handler));
    handler();
  }

  static restartOnResize(scene, data = {}) {
    let armed = false;
    const handler = () => {
      LayoutSystem.updateFromScale(scene.scale);
      if (!armed) {
        armed = true;
        return;
      }
      scene.scene.restart(data);
    };
    scene.scale.on('resize', handler);
    scene.events.once('shutdown', () => scene.scale.off('resize', handler));
    handler();
  }
}
