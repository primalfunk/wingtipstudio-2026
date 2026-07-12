export class GameStateManager {
    constructor() {
      this.currentState = 'traversal';
      this.inputLocked = false;
      this.activeOverlay = null;
      this.flags = {};
      this.mapSeed = null;
      this.visitedRooms = new Set();
      this.roomHistory = [];
      this.terminalState = null;
    }
  
    setState(newState) {
      this.currentState = newState;
    }
  
    getState() {
      return this.currentState;
    }
  
    isTraversal() {
      return this.currentState === 'traversal';
    }
  
    isCombat() {
      return this.currentState === 'combat';
    }
  
    isDialogue() {
      return this.currentState === 'dialogue';
    }

    isConversation() {
      return this.currentState === 'conversation';
    }

    lockInput(activeOverlay = null) {
      this.inputLocked = true;
      this.activeOverlay = activeOverlay;
    }

    unlockInput() {
      this.inputLocked = false;
      this.activeOverlay = null;
    }

    isInputLocked() {
      return this.inputLocked;
    }

    setTerminalState(state) {
      this.terminalState = state;
      if (state) {
        this.lockInput(state);
      }
    }

    getTerminalState() {
      return this.terminalState;
    }

    clearTerminalState() {
      this.terminalState = null;
    }

    setFlag(flag, value = true) {
      this.flags[flag] = value;
    }

    hasFlag(flag) {
      return Boolean(this.flags[flag]);
    }

    getFlags() {
      return { ...this.flags };
    }

    setFlags(flags = {}) {
      this.flags = { ...flags };
    }

    setMapSeed(seed) {
      this.mapSeed = seed;
    }

    getMapSeed() {
      return this.mapSeed;
    }

    markVisited(roomId) {
      if (roomId) this.visitedRooms.add(roomId);
    }

    hasVisited(roomId) {
      return this.visitedRooms.has(roomId);
    }

    getVisitedRooms() {
      return [...this.visitedRooms];
    }

    setVisitedRooms(roomIds = []) {
      this.visitedRooms = new Set(roomIds);
    }

    recordMove(fromRoomId, toRoomId) {
      if (!fromRoomId || !toRoomId || fromRoomId === toRoomId) return;
      this.roomHistory.push(fromRoomId);
      if (this.roomHistory.length > 24) {
        this.roomHistory.shift();
      }
      this.markVisited(toRoomId);
    }

    canBacktrack() {
      return this.roomHistory.length > 0;
    }

    popBacktrackRoom() {
      return this.roomHistory.pop() || null;
    }

    getRecentRooms(count = 5) {
      return this.roomHistory.slice(-count);
    }

    setRoomHistory(roomHistory = []) {
      this.roomHistory = [...roomHistory];
    }

    getRoomHistory() {
      return [...this.roomHistory];
    }
  }
  
