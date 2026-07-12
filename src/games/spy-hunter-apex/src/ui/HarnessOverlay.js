export default class HarnessOverlay {
  constructor(scene, harnessState) {
    this.harnessState = harnessState;
    this.text = scene.add.text(10, 10, '', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '12px',
      color: '#c8f7d5',
      backgroundColor: '#08110d',
      padding: { x: 8, y: 7 },
    }).setDepth(250).setScrollFactor(0);
  }

  update(missionState) {
    const runs = this.harnessState.runs.length;
    const avgDistance = runs === 0
      ? 0
      : this.harnessState.runs.reduce((sum, run) => sum + run.distance, 0) / runs;
    const avgDamage = runs === 0
      ? 0
      : this.harnessState.runs.reduce((sum, run) => sum + run.damage, 0) / runs;

    this.text.setText([
      'AI HARNESS',
      `DIFF ${(this.harnessState.difficulty ?? 'medium').toUpperCase()}`,
      `RUN ${runs + 1}/${this.harnessState.maxRuns}`,
      `TIME ${missionState.elapsedTime.toFixed(1)}s`,
      `DIST ${Math.floor(missionState.distance)} MI`,
      `DAMAGE ${missionState.playerDamage}`,
      `LIVES ${missionState.playerLives} MODE ${missionState.playerMode}`,
      `AVG DIST ${Math.floor(avgDistance)} MI`,
      `AVG DAMAGE ${avgDamage.toFixed(1)}`,
    ]);
  }
}
