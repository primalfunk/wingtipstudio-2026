import { AdditiveBlending, BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Vector3 } from "three";
import { RaceTelemetry, TrackValidationTelemetry } from "../world/RaceTelemetry";
import { TrackPath } from "../world/TrackPath";
import { VisualIntensityState } from "./VisualIntensitySystem";
import { DirectorState } from "./RaceDirectorSystem";
import { VisualSettingsState } from "./VisualSettings";

interface SectionGlow {
  id: string;
  mesh: Mesh;
  material: MeshBasicMaterial;
  progress: number;
  pulse: number;
}

const up = new Vector3(0, 1, 0);

export class TrackFeedbackVisuals {
  readonly root = new Group();
  private readonly glows: SectionGlow[] = [];
  private settings: VisualSettingsState;
  private previousContacts: Record<string, number> = {};

  constructor(path: TrackPath, validation: TrackValidationTelemetry, settings: VisualSettingsState) {
    this.settings = settings;

    for (const section of validation.packSections) {
      const sample = path.getSampleAtProgress(section.progress);
      const color = getSectionColor(section.sectionType);
      const material = new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new Mesh(new BoxGeometry(Math.min(sample.width * 0.88, 4.8), 0.035, Math.max(1.6, section.progress * 0 + 1.8)), material);
      const forward = sample.tangent.clone().setY(0).normalize();

      mesh.position.copy(sample.point).addScaledVector(up, 0.11);
      mesh.quaternion.copy(getObjectQuaternion(forward));
      this.root.add(mesh);
      this.glows.push({
        id: section.id,
        mesh,
        material,
        progress: section.progress,
        pulse: 0,
      });
    }
  }

  setSettings(settings: VisualSettingsState): void {
    this.settings = settings;
    this.root.visible = settings.reactiveLighting && settings.trackTheme;
  }

  update(deltaTime: number, telemetry: RaceTelemetry, intensity: VisualIntensityState, director?: DirectorState): void {
    this.root.visible = this.settings.reactiveLighting && this.settings.trackTheme;

    if (!this.root.visible) {
      return;
    }

    for (const glow of this.glows) {
      const currentContacts = telemetry.sectionContactCounts[glow.id] ?? 0;
      const previousContacts = this.previousContacts[glow.id] ?? 0;

      if (currentContacts > previousContacts) {
        glow.pulse = Math.min(1, glow.pulse + 0.3);
      }
      if (director && director.sectionRole !== "Open Track" && glow.id.toLowerCase().includes(director.sectionRole.split(" ")[0].toLowerCase())) {
        glow.pulse = Math.max(glow.pulse, 0.45);
      }

      this.previousContacts[glow.id] = currentContacts;
      glow.pulse = Math.max(0, glow.pulse - deltaTime * 1.7);
      glow.material.opacity = 0.1 + intensity.glowIntensity * 0.08 + glow.pulse * 0.32;
    }
  }
}

function getSectionColor(sectionType: string): number {
  if (sectionType.includes("pegboard") || sectionType.includes("random")) return 0x7bdff2;
  if (sectionType.includes("slow")) return 0xbdb2ff;
  if (sectionType.includes("speed") || sectionType.includes("boost")) return 0x77ff7a;
  if (sectionType.includes("spinner") || sectionType.includes("paddle")) return 0xff9f1c;
  if (sectionType.includes("split") || sectionType.includes("merge")) return 0xa0c4ff;
  if (sectionType.includes("ramp")) return 0xcdb4db;
  return 0xffd166;
}

function getObjectQuaternion(tangent: Vector3): Object3D["quaternion"] {
  const object = new Object3D();
  object.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);

  return object.quaternion;
}
