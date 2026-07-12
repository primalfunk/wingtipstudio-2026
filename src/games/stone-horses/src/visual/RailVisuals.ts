import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import { TrackPath, TrackSample } from "../world/TrackPath";
import { casinoTrackTheme } from "./TrackVisualTheme";

export interface RailVisualHandle {
  root: Group;
  setEnabled: (enabled: boolean) => void;
  setCountdown: (label: string) => void;
  pulseAtProgress: (progress: number, intensity: number) => void;
  update: (deltaTime: number, elapsedTime: number) => void;
  finishBurst: () => void;
}

interface PulseStrip {
  mesh: Mesh;
  baseIntensity: number;
  pulse: number;
  material: MeshBasicMaterial;
}

interface StartGateVisual {
  setCountdown: (label: string) => void;
}

const up = new Vector3(0, 1, 0);

export function createRailVisuals(path: TrackPath, visualSamples: TrackSample[] = path.samples): RailVisualHandle {
  const root = new Group();
  const strips: PulseStrip[] = [];

  for (const side of [-1, 1] as const) {
    const topStrip = createContinuousTrimStrip(visualSamples, side, casinoTrackTheme.neonCyan, 0.94, 0.12, 0.16, 0.5);
    strips.push(topStrip);
    root.add(topStrip.mesh);
  }

  const startGate = addStartGate(root, path.samples[4]);
  addFinishGate(root, path.getSampleAtProgress(path.finishProgress));

  return {
    root,
    setEnabled: (enabled: boolean): void => {
      root.visible = enabled;
    },
    setCountdown: (label: string): void => {
      startGate.setCountdown(label);
    },
    pulseAtProgress: (progress: number, intensity: number): void => {
      for (const strip of strips) {
        strip.pulse = Math.max(strip.pulse, intensity * 0.08);
      }
    },
    update: (deltaTime: number, elapsedTime: number): void => {
      for (const strip of strips) {
        strip.pulse = Math.max(0, strip.pulse - deltaTime * 2.4);
        const flow = (Math.sin(elapsedTime * 1.45) + 1) * 0.5;
        strip.material.opacity = strip.baseIntensity + strip.pulse * 0.24 + flow * 0.045;
      }
    },
    finishBurst: (): void => {
      for (const strip of strips) {
        strip.pulse = Math.max(strip.pulse, 0.8);
      }
    },
  };
}

function createContinuousTrimStrip(
  samples: TrackSample[],
  side: -1 | 1,
  color: number,
  height: number,
  width: number,
  baseIntensity: number,
  lateralOffset: number,
): PulseStrip {
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: baseIntensity,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new Mesh(createRailRibbonGeometry(samples, side, height, width, lateralOffset), material);

  return {
    mesh,
    baseIntensity,
    pulse: 0,
    material,
  };
}

function createRailRibbonGeometry(samples: TrackSample[], side: -1 | 1, height: number, width: number, lateralOffset: number): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const sample of samples) {
    const lateral = new Vector3().crossVectors(up, sample.tangent).normalize();
    const center = sample.point
      .clone()
      .addScaledVector(lateral, side * (sample.width * 0.5 + lateralOffset))
      .addScaledVector(up, height);
    const inner = center.clone().addScaledVector(lateral, -side * width * 0.5);
    const outer = center.clone().addScaledVector(lateral, side * width * 0.5);

    vertices.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
  }

  for (let i = 0; i < samples.length - 1; i += 1) {
    const inner = i * 2;
    const outer = inner + 1;
    const nextInner = inner + 2;
    const nextOuter = inner + 3;

    indices.push(inner, nextInner, outer, outer, nextInner, nextOuter);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeVertexNormals();

  return geometry;
}

function addStartGate(root: Group, sample: TrackSample): StartGateVisual {
  const lateral = new Vector3().crossVectors(up, sample.tangent).normalize();
  const forward = sample.tangent.clone().setY(0).normalize();
  const width = sample.width + 1.35;
  const height = 1.46;
  const quaternion = getObjectQuaternion(forward);
  const darkMetal = new MeshStandardMaterial({
    color: 0x070d13,
    emissive: 0x02080c,
    emissiveIntensity: 0.18,
    roughness: 0.26,
    metalness: 0.55,
  });
  const cyanLight = new MeshBasicMaterial({
    color: casinoTrackTheme.neonCyan,
    transparent: true,
    opacity: 0.82,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const magentaLight = createGateLightMaterial(0.82);

  for (const side of [-1, 1] as const) {
    const postCenter = sample.point.clone().addScaledVector(lateral, side * width * 0.5).addScaledVector(up, height * 0.5);
    const post = new Mesh(new BoxGeometry(0.34, height, 0.34), darkMetal);
    const postLight = new Mesh(new BoxGeometry(0.045, height * 0.72, 0.038), cyanLight);

    post.position.copy(postCenter);
    post.quaternion.copy(quaternion);
    root.add(post);
    postLight.position.copy(postCenter.clone().addScaledVector(lateral, -side * 0.19).addScaledVector(up, 0.08));
    postLight.quaternion.copy(quaternion);
    root.add(postLight);
  }

  const beamCenter = sample.point.clone().addScaledVector(up, height + 0.08);
  const beam = new Mesh(new BoxGeometry(width, 0.34, 0.22), darkMetal);
  beam.position.copy(beamCenter);
  beam.quaternion.copy(quaternion);
  root.add(beam);

  for (const side of [-1, 1] as const) {
    const edge = new Mesh(new BoxGeometry(width * 0.34, 0.045, 0.04), side > 0 ? cyanLight : magentaLight);
    edge.position.copy(beamCenter.clone().addScaledVector(lateral, side * width * 0.28).addScaledVector(up, 0.2));
    edge.quaternion.copy(quaternion);
    root.add(edge);
  }

  const countdownPanel = createCountdownPanel();
  const number = new Mesh(new PlaneGeometry(0.58, 0.42), countdownPanel.material);
  number.position.copy(beamCenter.clone().addScaledVector(up, 0.01).addScaledVector(forward, -0.13));
  number.quaternion.copy(quaternion);
  root.add(number);

  const bulbs: MeshBasicMaterial[] = [];
  for (let i = 0; i < 7; i += 1) {
    const t = i / 6 - 0.5;
    if (Math.abs(t) < 0.13) continue;
    const bulbMaterial = createGateLightMaterial(0.28);
    const bulb = new Mesh(new CylinderGeometry(0.055, 0.055, 0.035, 16), bulbMaterial);
    bulb.position.copy(beamCenter.clone().addScaledVector(lateral, t * width * 0.62).addScaledVector(forward, -0.14));
    bulb.quaternion.copy(quaternion);
    root.add(bulb);
    bulbs.push(bulbMaterial);
  }

  return {
    setCountdown: (label: string): void => {
      countdownPanel.setLabel(label || "READY");
      const activePairs = label === "3" ? 1 : label === "2" ? 2 : label === "1" || label === "START!" ? 3 : 0;

      for (let index = 0; index < bulbs.length; index += 1) {
        const pairIndexFromCenter = index < 3 ? 2 - index : index - 3;
        const isActive = pairIndexFromCenter < activePairs;
        bulbs[index].opacity = label === "START!" ? 0.96 : isActive ? 0.88 : 0.22;
        bulbs[index].color.setHex(label === "START!" && isActive ? casinoTrackTheme.neonCyan : casinoTrackTheme.neonPink);
      }
    },
  };
}

function addFinishGate(root: Group, sample: TrackSample): void {
  const lateral = new Vector3().crossVectors(up, sample.tangent).normalize();
  const forward = sample.tangent.clone().setY(0).normalize();
  const width = sample.width + 0.9;
  const height = 1.15;
  const darkMetal = new MeshStandardMaterial({
    color: 0x090e13,
    emissive: 0x251a05,
    emissiveIntensity: 0.18,
    roughness: 0.28,
    metalness: 0.52,
  });
  const goldLight = new MeshBasicMaterial({
    color: casinoTrackTheme.finishMarquee,
    transparent: true,
    opacity: 0.66,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const quaternion = getObjectQuaternion(forward);

  for (const side of [-1, 1] as const) {
    const post = new Mesh(new BoxGeometry(0.18, height, 0.18), darkMetal);
    post.position.copy(sample.point.clone().addScaledVector(lateral, side * width * 0.5).addScaledVector(up, height * 0.5));
    post.quaternion.copy(quaternion);
    root.add(post);
  }

  const sign = new Mesh(new BoxGeometry(width, 0.24, 0.12), darkMetal);
  const light = new Mesh(new BoxGeometry(width * 0.72, 0.045, 0.035), goldLight);
  sign.position.copy(sample.point.clone().addScaledVector(up, height + 0.08));
  light.position.copy(sample.point.clone().addScaledVector(up, height + 0.23).addScaledVector(forward, -0.08));
  sign.quaternion.copy(quaternion);
  light.quaternion.copy(quaternion);
  root.add(sign);
  root.add(light);
}

function createGateLightMaterial(opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: casinoTrackTheme.neonPink,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

function createCountdownPanel(): { material: MeshBasicMaterial; setLabel: (label: string) => void } {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create start gate number canvas.");

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  let lastLabel = "";
  const setLabel = (label: string): void => {
    if (label === lastLabel) {
      return;
    }

    lastLabel = label;
    const displayLabel = label === "START!" ? "GO" : label;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(6, 9, 14, 0.96)";
    roundedRect(context, 22, 18, 148, 92, 12);
    context.fill();
    context.strokeStyle = label === "START!" ? "rgba(133, 216, 255, 0.96)" : "rgba(255, 79, 216, 0.9)";
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = label === "READY" ? "rgba(255, 209, 102, 0.72)" : "rgba(255, 245, 255, 0.98)";
    context.font = displayLabel.length > 2 ? "900 36px Arial, sans-serif" : "900 76px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = label === "START!" ? "rgba(133, 216, 255, 0.75)" : "rgba(255, 79, 216, 0.72)";
    context.shadowBlur = 12;
    context.fillText(displayLabel, 96, 68);
    context.shadowBlur = 0;
    texture.needsUpdate = true;
  };

  setLabel("READY");

  return { material, setLabel };
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function getObjectQuaternion(tangent: Vector3): Quaternion {
  const object = { quaternion: new Quaternion() };
  const flatTangent = tangent.clone().setY(0).normalize();
  const matrix = new Matrix4().makeRotationY(Math.atan2(flatTangent.x, flatTangent.z));

  object.quaternion.setFromRotationMatrix(matrix);

  return object.quaternion;
}
