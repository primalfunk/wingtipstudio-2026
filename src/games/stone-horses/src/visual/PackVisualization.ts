import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from "three";
import { Marble } from "../world/Marble";
import { RaceController } from "../world/RaceController";
import { VisualIntensityState } from "./VisualIntensitySystem";
import { VisualSettingsState } from "./VisualSettings";

export class PackVisualization {
  readonly root = new Group();
  private readonly lines: Line[] = [];
  private settings: VisualSettingsState;

  constructor(settings: VisualSettingsState) {
    this.settings = settings;

    for (let i = 0; i < 6; i += 1) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(6), 3));
      const line = new Line(
        geometry,
        new LineBasicMaterial({
          color: 0x85d8ff,
          transparent: true,
          opacity: 0,
        }),
      );
      this.lines.push(line);
      this.root.add(line);
    }
  }

  setSettings(settings: VisualSettingsState): void {
    this.settings = settings;
    this.root.visible = settings.reactiveLighting;
  }

  update(race: RaceController, marbles: Marble[], intensity: VisualIntensityState): void {
    this.root.visible = this.settings.reactiveLighting;

    if (!this.root.visible) {
      return;
    }

    const active = race.rankings.filter((status) => !status.finished).slice(0, 5).map((status) => status.marble);
    const center = getCenter(active);
    const spread = getSpread(active, center);
    const density = Math.max(0, 1 - spread / 7);

    this.updateProximityLines(active, density);
  }

  private updateProximityLines(active: Marble[], density: number): void {
    let lineIndex = 0;

    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) {
        if (lineIndex >= this.lines.length) {
          return;
        }

        const distance = active[i].position.distanceTo(active[j].position);

        if (distance > 2.1) {
          continue;
        }

        const line = this.lines[lineIndex];
        const positions = line.geometry.getAttribute("position") as BufferAttribute;
        positions.setXYZ(0, active[i].position.x, active[i].position.y + 0.25, active[i].position.z);
        positions.setXYZ(1, active[j].position.x, active[j].position.y + 0.25, active[j].position.z);
        positions.needsUpdate = true;
        (line.material as LineBasicMaterial).opacity = Math.max(0.08, density * 0.32);
        lineIndex += 1;
      }
    }

    for (let i = lineIndex; i < this.lines.length; i += 1) {
      (this.lines[i].material as LineBasicMaterial).opacity = 0;
    }
  }
}

function getCenter(marbles: Marble[]): Vector3 {
  const center = new Vector3();

  for (const marble of marbles) {
    center.add(marble.position);
  }

  return center.multiplyScalar(1 / Math.max(1, marbles.length));
}

function getSpread(marbles: Marble[], center: Vector3): number {
  return Math.max(0, ...marbles.map((marble) => marble.position.distanceTo(center)));
}
