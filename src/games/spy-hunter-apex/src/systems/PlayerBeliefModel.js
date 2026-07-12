export default class PlayerBeliefModel {
  constructor(missionState) {
    this.missionState = missionState;
    this.trustsSupportVans = 0;
    this.attacksSupportVans = 0;
    this.acceptsDecoySupport = 0;
    this.detectsDecoySupport = 0;
    this.shootsFirst = 0;
  }

  recordSupportPickup(isDecoy) {
    this.trustsSupportVans += 1;
    if (isDecoy) {
      this.acceptsDecoySupport += 1;
    }
    this.sync();
  }

  recordSupportAttack(isDecoy) {
    this.attacksSupportVans += 1;
    this.shootsFirst += 1;
    if (isDecoy) {
      this.detectsDecoySupport += 1;
    }
    this.sync();
  }

  get supportCompliance() {
    const total = this.trustsSupportVans + this.attacksSupportVans;
    return total === 0 ? 0 : this.trustsSupportVans / total;
  }

  sync() {
    this.missionState.playerTendencies = {
      trustsSupportVans: this.trustsSupportVans,
      attacksSupportVans: this.attacksSupportVans,
      acceptsDecoySupport: this.acceptsDecoySupport,
      detectsDecoySupport: this.detectsDecoySupport,
      shootsFirst: this.shootsFirst,
      supportCompliance: this.supportCompliance,
    };
  }
}
