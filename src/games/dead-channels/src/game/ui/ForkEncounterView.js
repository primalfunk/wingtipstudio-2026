import { forkConfig, routeTypeColors, routeTypeLabels } from '../config/forks.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { visualConfig } from '../config/visuals.js';
import { FORK_STATE } from '../systems/ForkEncounter.js';
import { VisualSettings } from '../systems/VisualSettings.js';
import { fontConfig } from '../config/fonts.js';

const BRANCH_Y_OFFSETS = {
  2: [-90, 90],
  3: [-130, 0, 130],
  4: [-165, -55, 55, 165]
};

const TEXT_STYLE = {
  fontFamily: fontConfig.typing,
  fontSize: '24px'
};

export class ForkEncounterView {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(220);
    this.branchViews = new Map();
    this.rejectedBranchesHidden = false;
    this.rejectedBranchesFaded = false;
    this.statusText = scene.add.text(GAME_WIDTH / 2, 142, '', {
      fontFamily: fontConfig.prompt,
      fontSize: '32px',
      color: VisualSettings.highContrast ? '#ffffff' : '#fff0d8',
      align: 'center'
    }).setOrigin(0.5).setDepth(230).setAlpha(0).setShadow(0, 0, '#ff3151', VisualSettings.reduceGlow ? 0 : 8);
    this.consequenceText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 120, '', {
      fontFamily: fontConfig.ui,
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
      backgroundColor: 'rgba(4, 10, 18, 0.72)',
      padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setDepth(240).setAlpha(0);
  }

  showFork(forkEncounter) {
    this.clearBranches();
    this.forkEncounter = forkEncounter;
    this.rejectedBranchesHidden = false;
    this.rejectedBranchesFaded = false;
    this.container.setAlpha(1);
    this.statusText.setText('BRANCH LATTICE DETECTED').setAlpha(1);

    const centerY = GAME_HEIGHT / 2;
    const offsets = BRANCH_Y_OFFSETS[forkEncounter.branches.length] ?? BRANCH_Y_OFFSETS[3];

    const trunk = this.scene.add.graphics();
    trunk.lineStyle(2, visualConfig.colors.cyan, VisualSettings.reduceGlow ? 0.12 : 0.26);
    trunk.lineBetween(GAME_WIDTH / 2 - 420, centerY, GAME_WIDTH / 2 + 420, centerY);
    this.container.add(trunk);

    forkEncounter.branches.forEach((branch, index) => {
      const y = centerY + offsets[index];
      const color = routeTypeColors[branch.routeType];
      const x = GAME_WIDTH / 2;
      const width = Math.min(820, Math.max(560, branch.text.length * 17 + 180));
      const panel = this.scene.add.graphics();
      panel.fillStyle(0x020810, 0.82);
      panel.fillRect(x - width / 2, y - 50, width, 100);
      panel.lineStyle(1, color, 0.5);
      panel.strokeRect(x - width / 2, y - 50, width, 100);
      panel.lineStyle(2, color, 0.34);
      panel.lineBetween(x - width / 2 + 16, y - 23, x + width / 2 - 16, y - 23);
      const label = this.scene.add.text(x - width / 2 + 26, y - 34, routeTypeLabels[branch.routeType], {
        fontFamily: fontConfig.ui,
        fontSize: '20px',
        color: `#${color.toString(16).padStart(6, '0')}`
      }).setOrigin(0, 0.5).setShadow(0, 0, `#${color.toString(16).padStart(6, '0')}`, VisualSettings.reduceGlow ? 0 : 5);
      const phrase = this.scene.add.text(x, y + 2, branch.text, {
        ...TEXT_STYLE,
        color: VisualSettings.highContrast ? '#ffffff' : '#e8fbff'
      }).setOrigin(0.5, 0.5).setShadow(0, 0, '#35dfff', VisualSettings.reduceGlow ? 0 : 3);
      const preview = this.scene.add.text(x - width / 2 + 26, y + 34, this.getPreviewText(branch), {
        fontFamily: fontConfig.ui,
        fontSize: '14px',
        color: '#a8b9c4'
      }).setOrigin(0, 0.5);

      this.container.add([panel, label, phrase, preview]);
      const node = this.scene.add.circle(x - width / 2, y, 4, color, 0.8);
      this.container.add(node);
      this.branchViews.set(branch.id, {
        path: panel,
        panel,
        label,
        phrase,
        preview,
        node,
        width,
        baseX: x,
        baseY: y,
        routeLabelOffset: -34,
        previewOffset: 34
      });

      this.setBranchViewAlpha({ label, phrase, preview, node, path: panel }, 0.42);
    });
  }

  update() {
    if (!this.forkEncounter) {
      return;
    }

    if (this.forkEncounter.state === FORK_STATE.TELEGRAPHING) {
      this.statusText.setText('BRANCH LATTICE DETECTED');
      this.setSelectableBranchVisibility(false);
    } else if (this.forkEncounter.state === FORK_STATE.SELECTABLE) {
      this.statusText.setText('TYPE TRANSMISSION TO COMMIT');
      this.setSelectableBranchVisibility(true);
    } else if (this.forkEncounter.state === FORK_STATE.COMMITTED) {
      this.statusText.setText(`${routeTypeLabels[this.forkEncounter.committedBranch.routeType]} ROUTE LOCKED`);
      this.fadeRejectedBranches(this.forkEncounter.committedBranch);
    }

    this.forkEncounter.branches.forEach((branch) => this.updateBranchText(branch));

    if (this.forkEncounter.state === FORK_STATE.COMMITTED && !this.rejectedBranchesHidden) {
      this.hideRejectedAfterFirstWord(this.forkEncounter.committedBranch);
    }
  }

  emphasizeCommit(branch) {
    const compactOffsets = this.getCompactOffsets(this.forkEncounter.branches.length);
    const compactX = Math.min(GAME_WIDTH - 560, 640);
    this.forkEncounter.branches.forEach((candidate) => {
      const view = this.branchViews.get(candidate.id);

      if (!view) {
        return;
      }

      this.scene.tweens.killTweensOf([view.label, view.phrase, view.preview, view.node, view.path]);
      const index = this.forkEncounter.branches.indexOf(candidate);
      const targetY = GAME_HEIGHT / 2 + compactOffsets[index];
      view.baseX = compactX;
      view.baseY = targetY;

      if (candidate.id === branch.id) {
        this.scene.tweens.add({
          targets: [view.path, view.node],
          alpha: 1,
          scaleX: 1.04,
          scaleY: 1.04,
          duration: 180,
          ease: 'Sine.easeOut'
        });
      } else {
        this.scene.tweens.add({
          targets: [view.path, view.node],
          alpha: 0.24,
          duration: 280,
          ease: 'Sine.easeOut'
        });
      }

      this.scene.tweens.add({
        targets: view.phrase,
        x: compactX,
        y: targetY,
        alpha: candidate.id === branch.id ? 1 : 0.12,
        duration: 320,
        ease: 'Cubic.easeOut'
      });
      this.scene.tweens.add({
        targets: view.label,
        x: compactX,
        y: targetY + view.routeLabelOffset,
        alpha: candidate.id === branch.id ? 1 : 0.16,
        duration: 320,
        ease: 'Cubic.easeOut'
      });
      this.scene.tweens.add({
        targets: view.preview,
        x: compactX,
        y: targetY + view.previewOffset,
        alpha: candidate.id === branch.id ? 1 : 0.08,
        duration: 320,
        ease: 'Cubic.easeOut'
      });
    });
    this.rejectedBranchesFaded = true;
  }

  setSelectableBranchVisibility(selectable) {
    if (this.forkEncounter.committedBranch) {
      return;
    }

    this.branchViews.forEach((view) => {
      this.setBranchViewAlpha(view, selectable ? 1 : 0.42);
    });
  }

  setBranchViewAlpha(view, alpha) {
    view.path?.setAlpha(Math.max(0.14, alpha * 0.55));
    view.node?.setAlpha(Math.max(0.24, alpha));
    view.label?.setAlpha(alpha);
    view.phrase?.setAlpha(alpha);
    view.preview?.setAlpha(Math.max(0.18, alpha * 0.75));
  }

  fadeRejectedBranches(branch) {
    if (this.rejectedBranchesFaded || !branch) {
      return;
    }

    this.rejectedBranchesFaded = true;
    this.forkEncounter.branches.forEach((candidate) => {
      const view = this.branchViews.get(candidate.id);
      if (!view) {
        return;
      }

      if (candidate.id === branch.id) {
        this.setBranchViewAlpha(view, 1);
        return;
      }

      this.scene.tweens.killTweensOf([view.path, view.label, view.phrase, view.preview, view.node]);
      this.scene.tweens.add({
        targets: [view.label, view.phrase, view.preview],
        alpha: 0.1,
        duration: 180,
        ease: 'Sine.easeOut'
      });
      this.scene.tweens.add({
        targets: [view.path, view.node],
        alpha: 0.16,
        duration: 180,
        ease: 'Sine.easeOut'
      });
    });
  }

  hideRejectedAfterFirstWord(branch) {
    if (!branch || !this.isFirstWordComplete(branch)) {
      return;
    }

    this.rejectedBranchesHidden = true;
    this.forkEncounter.branches.forEach((candidate) => {
      if (candidate.id === branch.id) {
        return;
      }

      const view = this.branchViews.get(candidate.id);
      if (!view) {
        return;
      }

      this.scene.tweens.add({
        targets: [view.path, view.label, view.phrase, view.preview, view.node],
        alpha: 0,
        x: '-=34',
        duration: 240,
        ease: 'Sine.easeIn'
      });
    });
  }

  isFirstWordComplete(branch) {
    const firstSpaceIndex = branch.text.indexOf(' ');
    const firstWordLength = firstSpaceIndex === -1 ? branch.text.length : firstSpaceIndex;
    return branch.validator.currentIndex >= firstWordLength;
  }

  getCompactOffsets(count) {
    if (count === 2) return [-34, 34];
    if (count === 4) return [-72, -24, 24, 72];
    return [-52, 0, 52];
  }

  flashMistake(branch) {
    const view = this.branchViews.get(branch.id);
    if (!view) {
      return;
    }

    this.scene.tweens.add({
      targets: view.phrase,
      x: view.baseX + 10,
      duration: 45,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut'
    });
  }

  playComplete(consequence, onComplete) {
    this.showConsequence(consequence);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: forkConfig.resolveDelayMs,
      ease: 'Sine.easeOut',
      onComplete
    });
  }

  playMiss(consequence, onComplete) {
    this.showConsequence(consequence);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: 18,
      duration: forkConfig.resolveDelayMs,
      ease: 'Cubic.easeIn',
      onComplete
    });
  }

  hideStatus() {
    this.statusText.setAlpha(0);
  }

  destroy() {
    this.container.destroy();
    this.statusText.destroy();
    this.consequenceText.destroy();
  }

  updateBranchText(branch) {
    const view = this.branchViews.get(branch.id);
    if (!view) {
      return;
    }

    const progress = branch.validator.getProgress();
    const typed = progress.typedPrefix;
    const current = progress.currentCharacter ? `[${progress.currentCharacter}]` : '';
    view.phrase.setText(`${typed}${current}${progress.remainingText}`);
  }

  showConsequence(consequence) {
    const parts = [];
    if (consequence.score) parts.push(`${consequence.score > 0 ? '+' : ''}${consequence.score} SCORE`);
    if (consequence.integrity) parts.push(`${consequence.integrity > 0 ? '+' : ''}${consequence.integrity} INTEGRITY`);
    if (consequence.flow === 'reset') parts.push('FLOW RESET');
    if (Number.isFinite(consequence.flow) && consequence.flow !== 0) parts.push(`${consequence.flow > 0 ? '+' : ''}${consequence.flow} FLOW`);
    if (consequence.instability) parts.push(`${consequence.instability > 0 ? '+' : ''}${consequence.instability} INSTABILITY`);

    this.consequenceText.setText(parts.join('   ') || 'ROUTE RESOLVED').setAlpha(1);
    this.scene.tweens.add({
      targets: this.consequenceText,
      alpha: 0,
      delay: 950,
      duration: 450,
      ease: 'Sine.easeOut'
    });
  }

  clearBranches() {
    this.scene.tweens.killTweensOf(this.container.list);
    this.container.removeAll(true);
    this.container.setPosition(0, 0).setAlpha(1);
    this.branchViews.clear();
  }

  getPreviewText(branch) {
    if (branch.routeType === 'safe') return 'low risk / modest signal';
    if (branch.routeType === 'reward') return 'higher signal / unstable';
    if (branch.routeType === 'repair') return 'restores integrity';
    if (branch.routeType === 'archive') return 'flow archive / harder';
    if (branch.routeType === 'corruption') return 'high signal / dangerous';
    return `difficulty ${branch.difficulty}`;
  }
}
