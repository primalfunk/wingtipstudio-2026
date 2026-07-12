import { DEFAULT_SETTINGS } from "./SettingsManager";
import type { GradeLevel, GradeStats, Profile, Settings, StoredData } from "./types";

export const STORAGE_KEY = "math-blaster-neo:v1";
const GRADES: GradeLevel[] = ["K", "1", "2", "3", "4", "5", "6"];

function blankStats(): Record<GradeLevel, GradeStats> {
  return Object.fromEntries(
    GRADES.map((grade) => [grade, { highScore: 0, bestGameLevel: 1, gamesPlayed: 0 }])
  ) as Record<GradeLevel, GradeStats>;
}

function createData(): StoredData {
  return {
    version: 1,
    activeProfileId: null,
    profiles: [],
    globalSettings: { ...DEFAULT_SETTINGS }
  };
}

export class ProfileManager {
  private data: StoredData = createData();

  constructor() {
    this.load();
  }

  get snapshot(): StoredData {
    return structuredClone(this.data);
  }

  get activeProfile(): Profile | null {
    return this.data.profiles.find((profile) => profile.id === this.data.activeProfileId) ?? null;
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredData;
      if (parsed.version === 1 && Array.isArray(parsed.profiles)) {
        this.data = {
          version: 1,
          activeProfileId: parsed.activeProfileId,
          profiles: parsed.profiles.map((profile) => ({
            ...profile,
            statsByGrade: { ...blankStats(), ...profile.statsByGrade }
          })),
          globalSettings: { ...DEFAULT_SETTINGS, ...parsed.globalSettings }
        };
      }
    } catch {
      this.data = createData();
    }
  }

  save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  createProfile(name: string): Profile {
    const profile: Profile = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 24) || "Player",
      createdAt: new Date().toISOString(),
      selectedGrade: "K",
      statsByGrade: blankStats()
    };
    this.data.profiles.push(profile);
    this.data.activeProfileId = profile.id;
    this.save();
    return profile;
  }

  deleteProfile(id: string): void {
    this.data.profiles = this.data.profiles.filter((profile) => profile.id !== id);
    if (this.data.activeProfileId === id) {
      this.data.activeProfileId = this.data.profiles[0]?.id ?? null;
    }
    this.save();
  }

  selectProfile(id: string): void {
    if (this.data.profiles.some((profile) => profile.id === id)) {
      this.data.activeProfileId = id;
      this.save();
    }
  }

  setGrade(grade: GradeLevel): void {
    const profile = this.activeProfile;
    if (!profile) return;
    profile.selectedGrade = grade;
    this.save();
  }

  updateSettings(settings: Partial<Settings>): void {
    this.data.globalSettings = { ...this.data.globalSettings, ...settings };
    this.save();
  }

  recordGame(score: number, grade: GradeLevel, gameLevel: number): void {
    const profile = this.activeProfile;
    if (!profile) return;
    const stats = profile.statsByGrade[grade];
    stats.highScore = Math.max(stats.highScore, score);
    stats.bestGameLevel = Math.max(stats.bestGameLevel, gameLevel);
    stats.gamesPlayed += 1;
    this.save();
  }
}
