import type { Challenge, DifficultyLevelConfig, EquationItem, GradeLevel } from "./types";

const id = () => crypto.randomUUID();
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(items: T[]) => items[rand(0, items.length - 1)];
const frac = (n: number, d: number) => `${n}/${d}`;
const displayFrac = (n: number | string, d: number | string) => `${n}⁄${d}`;

export class ProblemGenerator {
  generate(grade: GradeLevel, config?: DifficultyLevelConfig): Challenge {
    const challenge = this.byGrade(grade, config);
    challenge.displayMode = "problemAmmo_answerTargets";
    return challenge;
  }

  createEquationItem(grade: GradeLevel, usedAnswers = new Set<string>(), config?: DifficultyLevelConfig): EquationItem {
    let challenge = this.generate(grade, config);
    let guard = 0;
    while ((usedAnswers.has(String(challenge.answer)) || this.isSingleNumberPrompt(challenge.prompt)) && guard < 80) {
      challenge = this.generate(grade, config);
      guard += 1;
    }
    const targetId = crypto.randomUUID();
    return {
      id: crypto.randomUUID(),
      prompt: challenge.prompt,
      answer: String(challenge.answer),
      targetId,
      resolved: false
    };
  }

  createEquationItems(grade: GradeLevel, count: number, config?: DifficultyLevelConfig): EquationItem[] {
    const answers = new Set<string>();
    return Array.from({ length: count }, () => {
      const item = this.createEquationItem(grade, answers, config);
      answers.add(item.answer);
      return item;
    });
  }

  private byGrade(grade: GradeLevel, config?: DifficultyLevelConfig): Challenge {
    const mode: Challenge["displayMode"] = "problemAmmo_answerTargets";
    const max = config?.maxProblemNumber ?? 50;
    if (grade === "K") {
      return this.kindergarten(max, mode);
    }
    if (grade === "1") {
      const type = pick(["add", "sub", "missing", "tens"]);
      if (type === "add") {
        return this.additionWithin(max, mode, 2);
      }
      if (type === "sub") {
        return this.subtractionWithin(max, mode, 2);
      }
      if (type === "missing") {
        const b = rand(1, Math.min(10, max)), ans = rand(0, max - b);
        return { id: id(), prompt: `? + ${b} = ${ans + b}`, answer: ans, displayMode: mode, difficultyWeight: 2 };
      }
      const tens = pick([10, 20, 30].filter((value) => value <= max));
      const ones = rand(0, Math.min(9, max - tens));
      return { id: id(), prompt: `${tens} + ${ones}`, answer: tens + ones, displayMode: mode, difficultyWeight: 2 };
    }
    if (grade === "2") {
      const type = pick(["add", "sub", "skip", "repeat"]);
      if (type === "add") {
        return this.additionWithin(max, mode, 3, 5);
      }
      if (type === "sub") {
        return this.subtractionWithin(max, mode, 3, 5);
      }
      if (type === "skip") {
        const step = pick([2, 5, 10].filter((value) => value * 4 <= max));
        const start = step, next = start + step * 3;
        return { id: id(), prompt: `${start}, ${start + step}, ${start + step * 2}, ?`, answer: next, displayMode: mode, difficultyWeight: 3 };
      }
      const a = rand(2, 5), b = rand(2, Math.max(2, Math.min(5, Math.floor(max / a))));
      return { id: id(), prompt: Array(b).fill(a).join(" + "), answer: a * b, displayMode: mode, difficultyWeight: 3 };
    }
    if (grade === "3") {
      const type = pick(["mul", "div", "add", "frac", "area"]);
      if (type === "mul") {
        const a = rand(0, 12), b = rand(0, 12);
        return { id: id(), prompt: `${a} × ${b}`, answer: a * b, displayMode: mode, difficultyWeight: 4 };
      }
      if (type === "div") {
        const b = rand(1, 12), ans = rand(0, 12);
        return { id: id(), prompt: `${b * ans} ÷ ${b}`, answer: ans, displayMode: mode, difficultyWeight: 4 };
      }
      if (type === "add") {
        return this.additionWithin(max, mode, 4, 10);
      }
      if (type === "frac") {
        const d = pick([2, 3, 4, 6]), whole = d * rand(2, 6);
        return { id: id(), prompt: `${whole} ÷ ${d}`, answer: whole / d, displayMode: mode, difficultyWeight: 4 };
      }
      const a = rand(2, 10), b = rand(2, 10);
      return { id: id(), prompt: `${a} × ${b}`, answer: a * b, displayMode: mode, difficultyWeight: 4 };
    }
    if (grade === "4") {
      const type = pick(["add", "mul", "div", "factor", "fraction", "decimal"]);
      if (type === "add") {
        return this.additionWithin(max, mode, 5, 10);
      }
      if (type === "mul") {
        const a = rand(12, 89), b = rand(2, 9);
        return { id: id(), prompt: `${a} × ${b}`, answer: a * b, displayMode: mode, difficultyWeight: 5 };
      }
      if (type === "div") {
        const b = rand(2, 12), ans = rand(3, 12);
        return { id: id(), prompt: `${b * ans} ÷ ${b}`, answer: ans, displayMode: mode, difficultyWeight: 5 };
      }
      if (type === "factor") {
        const n = pick([12, 18, 24, 30, 36, 42]);
        const answer = pick([2, 3, 6]);
        return { id: id(), prompt: `${answer} × ? = ${n}`, answer: n / answer, displayMode: mode, difficultyWeight: 5 };
      }
      if (type === "fraction") {
        const d = pick([6, 8, 10, 12]);
        return { id: id(), prompt: `${displayFrac(1, 2)} = ${displayFrac("?", d)}`, answer: d / 2, displayMode: mode, difficultyWeight: 5 };
      }
      const a = rand(1, 8), b = rand(1, 9 - a);
      return { id: id(), prompt: `${(a / 10).toFixed(1)} + ${(b / 10).toFixed(1)}`, answer: ((a + b) / 10).toFixed(1), displayMode: mode, difficultyWeight: 5 };
    }
    if (grade === "5") {
      const type = pick(["mul", "div", "fraction", "decimal", "order", "volume"]);
      if (type === "mul") {
        const a = rand(12, 35), b = rand(11, 19);
        return { id: id(), prompt: `${a} × ${b}`, answer: a * b, displayMode: mode, difficultyWeight: 6 };
      }
      if (type === "div") {
        const b = rand(6, 15), ans = rand(8, 18);
        return { id: id(), prompt: `${b * ans} ÷ ${b}`, answer: ans, displayMode: mode, difficultyWeight: 6 };
      }
      if (type === "fraction") {
        const d = pick([6, 8, 10, 12]), a = rand(1, d - 3), b = rand(1, d - a - 1);
        return { id: id(), prompt: `${displayFrac(a, d)} + ${displayFrac(b, d)}`, answer: frac(a + b, d), displayMode: mode, difficultyWeight: 6 };
      }
      if (type === "decimal") {
        const a = rand(20, 90), b = rand(1, a - 1);
        return { id: id(), prompt: `${(a / 10).toFixed(1)} - ${(b / 10).toFixed(1)}`, answer: ((a - b) / 10).toFixed(1), displayMode: mode, difficultyWeight: 6 };
      }
      if (type === "order") {
        const a = rand(2, 9), b = rand(2, 5), c = rand(2, 6);
        return { id: id(), prompt: `${a} + ${b} × ${c}`, answer: a + b * c, displayMode: mode, difficultyWeight: 6 };
      }
      const a = rand(2, 6), b = rand(2, 6), c = rand(2, 6);
      return { id: id(), prompt: `${a} × ${b} × ${c}`, answer: a * b * c, displayMode: mode, difficultyWeight: 6 };
    }
    const type = pick(["signedMul", "order", "ratio", "percent", "exp", "equation"]);
    if (type === "signedMul") {
      const a = pick([rand(-12, -3), rand(3, 12)]), b = rand(4, 12);
      return { id: id(), prompt: `${a} × ${b}`, answer: a * b, displayMode: mode, difficultyWeight: 7 };
    }
    if (type === "order") {
      const a = rand(3, 12), b = pick([rand(-9, -2), rand(2, 9)]), c = rand(2, 6);
      return { id: id(), prompt: `${a} + ${b} × ${c}`, answer: a + b * c, displayMode: mode, difficultyWeight: 7 };
    }
    if (type === "ratio") {
      const left = rand(2, 9), right = rand(3, 12), scale = rand(2, 5);
      return { id: id(), prompt: `${left}:${right} = ${left * scale}:?`, answer: right * scale, displayMode: mode, difficultyWeight: 7 };
    }
      if (type === "percent") {
        const pct = pick([15, 20, 25, 30, 40, 60, 75]), n = pick([60, 80, 120, 160, 200, 240]);
      return { id: id(), prompt: `${pct}% × ${n}`, answer: (pct / 100) * n, displayMode: mode, difficultyWeight: 7 };
    }
    if (type === "exp") {
      const a = rand(2, 5), b = rand(6, 18);
      return { id: id(), prompt: `${a}³ + ${b}`, answer: a ** 3 + b, displayMode: mode, difficultyWeight: 7 };
    }
    if (type === "equation") {
      const x = rand(-8, 15), coefficient = rand(2, 6), b = rand(3, 18);
      return { id: id(), prompt: `${coefficient}x + ${b} = ${coefficient * x + b}`, answer: x, displayMode: mode, difficultyWeight: 7 };
    }
    const a = pick([rand(-12, -3), rand(3, 12)]), b = rand(4, 12);
    return { id: id(), prompt: `${a} × ${b}`, answer: a * b, displayMode: mode, difficultyWeight: 7 };
  }

  private kindergarten(maxProblemNumber: number, mode: Challenge["displayMode"]): Challenge {
    const max = Math.max(0, Math.floor(maxProblemNumber));
    const type = pick(["add", "sub"]);
    if (type === "add") {
      return this.additionWithin(max, mode, 1);
    }
    return this.subtractionWithin(max, mode, 1);
  }

  private additionWithin(maxProblemNumber: number, mode: Challenge["displayMode"], difficultyWeight: number, minA = 0): Challenge {
    const max = Math.max(0, Math.floor(maxProblemNumber));
    const a = rand(Math.min(minA, max), max);
    const b = rand(0, max - a);
    return { id: id(), prompt: `${a} + ${b}`, answer: a + b, displayMode: mode, difficultyWeight };
  }

  private subtractionWithin(maxProblemNumber: number, mode: Challenge["displayMode"], difficultyWeight: number, minA = 0): Challenge {
    const max = Math.max(0, Math.floor(maxProblemNumber));
    const a = rand(Math.min(minA, max), max);
    const b = rand(0, a);
    return { id: id(), prompt: `${a} - ${b}`, answer: a - b, displayMode: mode, difficultyWeight };
  }

  private isSingleNumberPrompt(prompt: string): boolean {
    return /^-?\d+(?:\.\d+)?$/.test(prompt.trim());
  }
}
