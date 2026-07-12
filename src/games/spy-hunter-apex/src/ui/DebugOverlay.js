export default class DebugOverlay {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.visible = false;
    this.text = scene.add.text(10, 132, '', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '12px',
      color: '#ffefb0',
      backgroundColor: '#0b1014',
      padding: { x: 8, y: 7 },
    }).setDepth(200).setScrollFactor(0).setVisible(false);
  }

  toggle() {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
  }

  update() {
    if (!this.visible) {
      return;
    }

    const tendencies = this.missionState.playerTendencies ?? {};
    this.text.setText([
      `PHASE ${this.missionState.currentPacingPhase?.label ?? 'NONE'}`,
      `FLOW ${this.missionState.currentTrafficFlow?.label ?? 'NONE'}`,
      `ENCOUNTER ${this.missionState.currentEnemyEncounter?.label ?? 'NONE'}`,
      `SEG ${this.missionState.currentSegmentId}`,
      `TAGS ${(this.missionState.currentSegment?.tags ?? []).join(',')}`,
      `SUPPORT TRUST ${this.missionState.supportTrust.toFixed(2)}`,
      `ENEMY AWARE ${this.missionState.enemyAwareness.toFixed(2)}`,
      `SUPPORT COMPLY ${(tendencies.supportCompliance ?? 0).toFixed(2)}`,
      `INPUT ${this.scene.getInputVector ? JSON.stringify(this.scene.getInputVector()) : 'n/a'}`,
    ]);
  }
}
