export class TypingValidator {
  constructor(targetPhrase = '') {
    this.reset(targetPhrase);
  }

  reset(targetPhrase) {
    this.targetPhrase = targetPhrase;
    this.currentIndex = 0;
    this.mistakeCount = 0;
    this.correctInputCount = 0;
    this.totalInputCount = 0;
    this.lastInputCorrect = null;
    this.completed = targetPhrase.length === 0;
  }

  processCharacter(character) {
    if (this.completed || character.length !== 1) {
      return { accepted: false, correct: false, completed: this.completed };
    }

    this.totalInputCount += 1;
    const expected = this.targetPhrase[this.currentIndex];

    if (character === expected) {
      this.currentIndex += 1;
      this.correctInputCount += 1;
      this.completed = this.currentIndex >= this.targetPhrase.length;
      this.lastInputCorrect = true;
      return { accepted: true, correct: true, completed: this.completed };
    }

    this.mistakeCount += 1;
    this.lastInputCorrect = false;
    return { accepted: true, correct: false, completed: false, expected };
  }

  backspace() {
    if (this.currentIndex <= 0 || this.completed) {
      return false;
    }

    this.currentIndex -= 1;
    this.correctInputCount = Math.max(0, this.correctInputCount - 1);
    this.lastInputCorrect = null;
    return true;
  }

  getTypedPrefix() {
    return this.targetPhrase.slice(0, this.currentIndex);
  }

  getCurrentCharacter() {
    return this.targetPhrase[this.currentIndex] ?? '';
  }

  getRemainingText() {
    return this.targetPhrase.slice(this.currentIndex + 1);
  }

  getProgress() {
    return {
      targetPhrase: this.targetPhrase,
      currentIndex: this.currentIndex,
      typedPrefix: this.getTypedPrefix(),
      currentCharacter: this.getCurrentCharacter(),
      remainingText: this.getRemainingText(),
      completed: this.completed,
      mistakeCount: this.mistakeCount,
      correctInputCount: this.correctInputCount,
      totalInputCount: this.totalInputCount
    };
  }

  getCharacterStates() {
    return [...this.targetPhrase].map((character, index) => {
      if (index < this.currentIndex) {
        return { character, state: 'correct' };
      }

      if (index === this.currentIndex) {
        return { character, state: 'current' };
      }

      return { character, state: 'remaining' };
    });
  }
}
