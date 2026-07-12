import { CanvasTexture, Group, LinearFilter, Sprite, SpriteMaterial, Vector3 } from "three";
import { BetSlip } from "../betting/BettingSystem";
import { Marble } from "./Marble";
import { RacerIdentity } from "./RacerIdentity";

interface LabelEntry {
  marbleId: string;
  sprite: Sprite;
  texture: CanvasTexture;
  racer: RacerIdentity;
  isBet: boolean;
}

const labelWidth = 214;
const labelHeight = 74;
const labelOffset = new Vector3(0, 0.46, 0);

export class MarbleLabelSystem {
  readonly root = new Group();
  private readonly labelsById = new Map<string, LabelEntry>();

  constructor(marbles: Marble[], racers: RacerIdentity[]) {
    const racersById = new Map(racers.map((racer) => [racer.id, racer]));

    for (const marble of marbles) {
      const racer = racersById.get(marble.id);

      if (!racer) {
        continue;
      }

      const texture = createLabelTexture(racer, false);
      const sprite = new Sprite(
        new SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );

      sprite.scale.set(0.66, 0.23, 1);
      sprite.renderOrder = 50;
      this.root.add(sprite);
      this.labelsById.set(marble.id, {
        marbleId: marble.id,
        sprite,
        texture,
        racer,
        isBet: false,
      });
    }
  }

  updatePositions(marbles: Marble[]): void {
    for (const marble of marbles) {
      const label = this.labelsById.get(marble.id);

      if (!label) {
        continue;
      }

      label.sprite.position.copy(marble.position).add(labelOffset);
    }
  }

  updateBets(bets: BetSlip[]): void {
    const betMarbleIds = new Set<string>();

    for (const bet of bets) {
      betMarbleIds.add(bet.marbleId);

      if (bet.secondMarbleId) {
        betMarbleIds.add(bet.secondMarbleId);
      }
    }

    for (const label of this.labelsById.values()) {
      const isBet = betMarbleIds.has(label.marbleId);

      if (label.isBet === isBet) {
        continue;
      }

      label.texture.dispose();
      label.texture = createLabelTexture(label.racer, isBet);
      label.sprite.material.map = label.texture;
      label.sprite.material.needsUpdate = true;
      label.isBet = isBet;
    }
  }
}

function createLabelTexture(racer: RacerIdentity, isBet: boolean): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = labelWidth;
  canvas.height = labelHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create marble label canvas.");
  }

  context.clearRect(0, 0, labelWidth, labelHeight);
  const gradient = context.createLinearGradient(8, 15, labelWidth - 8, 55);
  gradient.addColorStop(0, isBet ? "rgba(64, 45, 10, 0.72)" : "rgba(5, 12, 18, 0.56)");
  gradient.addColorStop(1, isBet ? "rgba(12, 24, 31, 0.68)" : "rgba(16, 33, 40, 0.46)");
  context.fillStyle = gradient;
  roundedRect(context, 8, 15, labelWidth - 16, 40, 13);
  context.fill();

  context.lineWidth = isBet ? 3 : 1.25;
  context.strokeStyle = isBet ? "rgba(255, 211, 90, 0.86)" : "rgba(88, 228, 255, 0.42)";
  context.stroke();

  context.fillStyle = isBet ? "rgba(255, 211, 90, 0.94)" : "rgba(88, 228, 255, 0.84)";
  context.font = "800 15px Arial, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(racer.id, 18, 36);

  context.fillStyle = "rgba(245, 249, 252, 0.8)";
  context.font = "700 17px Arial, sans-serif";
  context.fillText(trimLabel(racer.name), 58, 36);

  if (isBet) {
    context.fillStyle = "rgba(255, 211, 90, 0.82)";
    context.beginPath();
    context.arc(labelWidth - 24, 35, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#1a1510";
    context.font = "800 14px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText("$", labelWidth - 24, 36);
  }

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
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

function trimLabel(name: string): string {
  return name.length > 10 ? `${name.slice(0, 9)}.` : name;
}
