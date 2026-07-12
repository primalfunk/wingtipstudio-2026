export type EquationCategory =
  | "addition"
  | "subtraction"
  | "multiplication"
  | "division"
  | "fractions"
  | "algebra"
  | "roots"
  | "exponents";

export type EquationRainPool = Record<EquationCategory, string[]>;

export const CATEGORY_COLORS: Record<EquationCategory, string> = {
  addition: "#7dff9a",
  subtraction: "#54d96f",
  multiplication: "#2ebf5a",
  division: "#b7ffc8",
  fractions: "#3fae57",
  algebra: "#d8ffe0",
  roots: "#1d7f3e",
  exponents: "#91f7a8"
};

export const EQUATION_RAIN_POOL: EquationRainPool = {
  addition: [
    "4 + 3 = 7",
    "8 + 6 = 14",
    "12 + 5 = 17",
    "9 + 9 = 18",
    "15 + 7 = 22",
    "24 + 18 = 42",
    "125 + 75 = 200"
  ],
  subtraction: [
    "9 - 4 = 5",
    "13 - 6 = 7",
    "20 - 8 = 12",
    "18 - 9 = 9",
    "25 - 10 = 15",
    "100 - 37 = 63",
    "-4 + 9 = 5"
  ],
  multiplication: [
    "7 × 6 = 42",
    "8 × 4 = 32",
    "9 × 5 = 45",
    "6 × 6 = 36",
    "12 × 3 = 36",
    "24 × 13 = 312",
    "11 × 11 = 121"
  ],
  division: [
    "18 ÷ 3 = 6",
    "42 ÷ 7 = 6",
    "56 ÷ 8 = 7",
    "81 ÷ 9 = 9",
    "100 ÷ 10 = 10",
    "144 ÷ 12 = 12",
    "96 ÷ 8 = 12"
  ],
  fractions: [
    "1/2 + 1/4 = 3/4",
    "3/4 - 1/4 = 1/2",
    "2/3 + 1/3 = 1",
    "1/5 + 3/5 = 4/5",
    "3/5 × 10 = 6",
    "2/8 + 3/8 = 5/8",
    "6/10 = 3/5"
  ],
  algebra: [
    "2x + 5 = 15",
    "x = 5",
    "3(x - 2) = 12",
    "x + 7 = 13",
    "4x = 20",
    "x - 9 = 6",
    "2x = 18"
  ],
  roots: [
    "√49 = 7",
    "√81 = 9",
    "√121 = 11",
    "√144 = 12",
    "√25 = 5",
    "√36 = 6",
    "√64 = 8"
  ],
  exponents: [
    "2² = 4",
    "3² = 9",
    "4² = 16",
    "2³ = 8",
    "3³ = 27",
    "5² = 25",
    "10² = 100"
  ]
};

export const EQUATION_CATEGORIES = Object.keys(EQUATION_RAIN_POOL) as EquationCategory[];
