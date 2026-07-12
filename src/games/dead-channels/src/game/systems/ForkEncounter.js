import { forkConfig } from '../config/forks.js';
import { TypingValidator } from './TypingValidator.js';

export const FORK_STATE = {
  INACTIVE: 'inactive',
  TELEGRAPHING: 'telegraphing',
  SELECTABLE: 'selectable',
  COMMITTED: 'committed',
  RESOLVING: 'resolving',
  COMPLETE: 'complete'
};

export class ForkEncounter {
  constructor({ rng, config = forkConfig, contentSelector = null }) {
    this.rng = rng;
    this.config = config;
    this.contentSelector = contentSelector;
    this.state = FORK_STATE.INACTIVE;
    this.branches = [];
    this.committedBranch = null;
    this.elapsedMs = 0;
    this.result = null;
    this.lastRouteTypes = [];
    this.selectionPrefix = '';
  }

  start() {
    this.state = FORK_STATE.TELEGRAPHING;
    this.elapsedMs = 0;
    this.result = null;
    this.committedBranch = null;
    this.selectionPrefix = '';
    this.branches = this.createBranches();
  }

  update(deltaMs) {
    if (this.state === FORK_STATE.INACTIVE || this.state === FORK_STATE.COMPLETE) {
      return null;
    }

    this.elapsedMs += deltaMs;

    if (this.state === FORK_STATE.TELEGRAPHING && this.elapsedMs >= this.config.telegraphDurationMs) {
      this.state = FORK_STATE.SELECTABLE;
      this.elapsedMs = 0;
    }

    if (this.state === FORK_STATE.SELECTABLE && this.elapsedMs >= this.config.selectionTimeoutMs) {
      const safeBranch = this.branches.find((branch) => branch.routeType === 'safe') ?? this.branches[0];
      this.commitBranch(safeBranch.id, { automatic: true });
    }

    if (this.state === FORK_STATE.COMMITTED && this.elapsedMs >= this.config.selectionTimeoutMs) {
      this.resolveMiss();
    }

    return this.result;
  }

  processCharacter(character) {
    if (this.state === FORK_STATE.TELEGRAPHING) {
      return { accepted: false, correct: false, completed: false };
    }

    if (this.state === FORK_STATE.SELECTABLE) {
      this.selectionPrefix += character;
      const matches = this.branches.filter((branch) => branch.text.startsWith(this.selectionPrefix));

      if (matches.length === 1) {
        const committedPrefix = this.selectionPrefix;
        this.commitBranch(matches[0].id);
        let result = null;
        for (const prefixCharacter of committedPrefix) {
          result = this.processCommittedCharacter(prefixCharacter);
        }
        return { ...result, committed: true };
      }

      if (matches.length === 0) {
        this.selectionPrefix = '';
      }

      return {
        accepted: true,
        correct: matches.length > 0,
        completed: false,
        ambiguous: matches.length > 1
      };
    }

    if (this.state === FORK_STATE.COMMITTED) {
      return this.processCommittedCharacter(character);
    }

    return { accepted: false, correct: false, completed: false };
  }

  backspace() {
    if (this.state !== FORK_STATE.COMMITTED || !this.committedBranch) {
      return false;
    }

    return this.committedBranch.validator.backspace();
  }

  commitBranch(branchId, options = {}) {
    const branch = this.branches.find((candidate) => candidate.id === branchId);

    if (!branch || this.state === FORK_STATE.COMMITTED) {
      return null;
    }

    this.state = FORK_STATE.COMMITTED;
    this.elapsedMs = 0;
    this.committedBranch = branch;
    this.selectionPrefix = '';
    branch.isCommitted = true;
    branch.automatic = Boolean(options.automatic);
    this.branches.forEach((candidate) => {
      candidate.isRejected = candidate.id !== branch.id;
    });

    return branch;
  }

  resolveMiss() {
    if (!this.committedBranch && this.state === FORK_STATE.SELECTABLE) {
      const safeBranch = this.branches.find((branch) => branch.routeType === 'safe') ?? this.branches[0];
      this.commitBranch(safeBranch.id, { automatic: true });
    }

    this.state = FORK_STATE.RESOLVING;
    this.result = {
      outcome: 'missed',
      branch: this.committedBranch,
      consequence: this.getMissConsequence(this.committedBranch)
    };
    return this.result;
  }

  complete() {
    this.state = FORK_STATE.COMPLETE;
  }

  getDebugInfo() {
    return {
      active: this.state !== FORK_STATE.INACTIVE && this.state !== FORK_STATE.COMPLETE,
      state: this.state,
      branchCount: this.branches.length,
      branchRouteTypes: this.branches.map((branch) => branch.routeType).join(', '),
      branchPhrases: this.branches.map((branch) => branch.text).join(' | '),
      committedBranch: this.committedBranch?.routeType ?? '(none)',
      timerMs: Math.round(this.elapsedMs)
    };
  }

  createBranches() {
    const count = Math.min(
      this.config.maxBranchCount ?? this.config.branchCountMax,
      this.rng.int(this.config.branchCountMin, this.config.branchCountMax)
    );
    const routeTypes = this.pickRouteTypes(count);

    return routeTypes.map((routeType, index) => {
      const phrase = this.pickPhrase(routeType);
      return {
        id: `branch-${index}`,
        routeType,
        text: phrase.text,
        contentEntry: phrase,
        difficulty: phrase.difficulty,
        tags: phrase.tags,
        validator: new TypingValidator(phrase.text),
        isCommitted: false,
        isRejected: false,
        automatic: false
      };
    });
  }

  pickRouteTypes(count) {
    const required = ['safe'];
    const pool = this.config.defaultRouteTypes.filter((routeType) => !required.includes(routeType));
    const selected = [...required];

    while (selected.length < count && pool.length > 0) {
      const routeType = this.rng.pick(pool);
      selected.push(routeType);
      pool.splice(pool.indexOf(routeType), 1);
    }

    this.shuffle(selected);
    return selected;
  }

  pickPhrase(routeType) {
    if (this.contentSelector) {
      return this.contentSelector.getRoutePhrase(routeType, {
        encounterIndex: this.config.encounterIndex ?? 0
      });
    }

    return {
      text: routeType === 'repair' ? 'repair the signal path'
        : routeType === 'reward' ? 'capture the bright packet'
          : routeType === 'archive' ? 'read the silent witness'
            : routeType === 'corruption' ? 'touch the hostile signal'
              : 'follow the quiet channel',
      routeType,
      difficulty: 1,
      tags: [routeType],
      biome: 'signalArchive'
    };
  }

  processCommittedCharacter(character) {
    const result = this.committedBranch.validator.processCharacter(character);

    if (result.completed) {
      this.state = FORK_STATE.RESOLVING;
      this.result = {
        outcome: 'completed',
        branch: this.committedBranch,
        consequence: this.getCompletionConsequence(this.committedBranch)
      };
    }

    return result;
  }

  getCompletionConsequence(branch) {
    const reward = this.config.routeRewardValues[branch.routeType];
    const imperfectInstability = branch.validator.mistakeCount > 0 ? reward.imperfectInstability ?? 0 : 0;

    return {
      score: reward.score ?? 0,
      integrity: reward.integrity ?? 0,
      flow: reward.flow ?? 0,
      instability: (reward.instability ?? 0) + imperfectInstability
    };
  }

  getMissConsequence(branch) {
    const penalty = this.config.routePenaltyValues[branch.routeType];
    return {
      score: 0,
      integrity: -(penalty.integrity ?? 0),
      flow: 'reset',
      instability: penalty.instability ?? 0
    };
  }

  shuffle(values) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = this.rng.int(0, index);
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
  }
}
