import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from "three";
import { BetSlip } from "../betting/BettingSystem";
import { RaceController } from "../world/RaceController";
import { Marble } from "../world/Marble";
import { VisualSettingsState } from "./VisualSettings";

export class MarbleVisuals {
  readonly root = new Group();
  private readonly betRings = new Map<string, Mesh>();
  private readonly marbles: Marble[];

  constructor(marbles: Marble[], _settings: VisualSettingsState) {
    this.marbles = marbles;

    for (const marble of marbles) {
      const ring = new Mesh(
        new RingGeometry(0.42, 0.48, 24),
        new MeshBasicMaterial({
          color: 0xffd166,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.betRings.set(marble.id, ring);
      this.root.add(ring);
    }
  }

  setSettings(_settings: VisualSettingsState): void {
  }

  update(deltaTime: number, _race: RaceController, bets: BetSlip[]): void {
    const betIds = new Set<string>();

    for (const bet of bets) {
      betIds.add(bet.marbleId);
      if (bet.secondMarbleId) betIds.add(bet.secondMarbleId);
    }

    for (const marble of this.marbles) {
      this.updateBetRing(marble, betIds.has(marble.id), deltaTime);
    }
  }

  private updateBetRing(marble: Marble, isBet: boolean, deltaTime: number): void {
    const ring = this.betRings.get(marble.id);

    if (!ring) {
      return;
    }

    const material = ring.material as MeshBasicMaterial;
    ring.position.copy(marble.position).add(new Vector3(0, 0.05, 0));
    material.opacity += ((isBet ? 0.44 : 0) - material.opacity) * Math.min(1, deltaTime * 8);
  }
}
