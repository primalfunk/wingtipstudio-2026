import { UI_THEME } from './UiTheme.js';
import { BrandedInfoFrame } from './components/BrandedInfoFrame.js';

function riskLabel(score) {
  if (score < 35) return 'LOW';
  if (score < 70) return 'MODERATE';
  if (score < 110) return 'HIGH';
  return 'EXTREME';
}

function tacticalNote(template) {
  if (template.clearanceLevel >= 4) return 'Command-grade access body with high strategic value.';
  if (template.weaponType !== 'none') return 'Armed chassis suited for direct confrontation.';
  if (template.clearanceLevel > 0) return 'Utility chassis with useful access rights.';
  return 'Low-risk body, limited combat value.';
}

export class DroidInfoCard {
  constructor(scene, x, y, title) {
    this.scene = scene;
    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(1200);
    this.container.setVisible(false);

    this.frame = new BrandedInfoFrame(scene, { width: 330, height: 238, title, status: '' });
    this.title = scene.add.text(-140, -78, title, {
      fontFamily: UI_THEME.fontFamily,
      fontSize: UI_THEME.smallSize,
      color: UI_THEME.textPrimary
    });
    this.body = scene.add.text(-140, -54, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: UI_THEME.smallSize,
      color: UI_THEME.textAccent,
      lineSpacing: 5,
      wordWrap: { width: 270 }
    });
    this.container.add([this.frame.container, this.title, this.body]);
  }

  showTarget(droid, playerRank, difficulty) {
    const template = droid.data.template;
    this.body.setText([
      `UNIT: ${template.displayId} ${template.name}`,
      `CLASS: ${template.chassisClass}`,
      `INTEGRITY: ${droid.data.currentIntegrity} / ${template.maxIntegrity}`,
      `WEAPON: ${template.weaponType}`,
      `CLEARANCE: ${template.clearanceLevel}`,
      `STABILITY: ${template.instabilityMax ?? 'STABLE'}`,
      `RESISTANCE: ${template.possessionResistance}`,
      `RISK: ${riskLabel(difficulty)}`,
      `NOTE: ${tacticalNote(template)}`
    ]);
    this.frame.setTitle('TARGET PROFILE');
    this.frame.setStatus(`UNIT ${template.displayId}`);
    this.title.setText(`RISK ${riskLabel(difficulty)}  //  R${Math.max(0, template.rank - playerRank)}`);
    this.container.setVisible(true);
  }

  showBody(body, runStats) {
    this.title.setText('CURRENT HOST');
    this.frame.setTitle('CURRENT HOST');
    this.frame.setStatus(`UNIT ${body.displayId}`);
    this.body.setText([
      `UNIT: ${body.displayId}`,
      `CLASS: ${body.chassisClass}`,
      `INTEGRITY: ${body.integrity} / ${body.maxIntegrity}`,
      `STABILITY: ${body.stabilityMax ? `${Math.ceil(body.stabilityCurrent)} / ${body.stabilityMax}` : 'STABLE'}`,
      `WEAPON: ${body.weaponType}`,
      `CLEARANCE: ${body.clearanceLevel ?? 0}`,
      `BODIES USED: ${runStats.bodiesPossessed}`,
      `HIGHEST HELD: ${String(runStats.highestRankPossessed).padStart(3, '0')}`
    ]);
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  isVisible() {
    return this.container.visible;
  }
}
