// Centralized tuning values for gameplay, visuals, audio, and generation.
// Keep this file human-readable; prefer descriptive grouping over flat lists.

// Storage keys.
const STORAGE = {
  GAME_STATE_KEY: "spaceGame_gameState_v1",
  SECTOR_INDEX_KEY: "spaceGame_sectorIndex_v1",
  MOUSE_AIM_KEY: "spaceSurveyor_mouseAim"
};

// Debug toggles for development.
const DEBUG = {
  VECTORS: true,
  APSE_COLLISION: false,
  SHIP_VISUALS: false
};

// Camera controls and screen shake.
const CAMERA = {
  ZOOM: {
    MIN: 0.1375,
    MAX: 1.8875,
    SPEED: 0.7,
    WHEEL_STEP: 0.0375,
    DEFAULT_OUT_STEPS: 3,
    OUT_STEPS_BASE: 0
  },
  SHAKE: {
    DURATION: 0.35,
    HIT: 6,
    SURVEY: 3,
    FIRE: 0.6
  }
};

// Core gameplay pacing.
const GAMEPLAY = {
  ACTIVE_SECTOR_RANGE: 1,
  STARTING_LIVES: 3,
  INVULN_DURATION: 1.25,
  GAME_OVER_DELAY: 0.7,
  RESPAWN_DELAY: 0.6,
  INTRO: {
    ALERT_DURATION: 4,
    START_DELAY: 0.5,
    SCORE_TIMEOUT: 10,
    FUEL_RATIO: 0.7,
    LONGRUN_TRANSITIONS: 2,
    STAR_PULL_ACCEL: 60,
    HIGHLIGHT_DURATION: 1.4,
    VIGNETTE_DURATION: 1.6,
    RIVER_HIGHLIGHT_DURATION: 1.4
  }
};

// Scoring values and popup styling.
const SCORE = {
  CHUNK_MULTIPLIER: 0.6,
  POINTS: {
    ASTEROID: 5,
    ENEMY: 25,
    FUEL: 15,
    SURVEY: 40
  },
  POPUP: {
    LIFE: 1.1,
    RISE: 26,
    SCALE_START: 0.6,
    SCALE_END: 1.25,
    GROW_TIME: 0.22,
    EDGE_MARGIN: 24,
    FONT_SIZE: 18
  },
  POPUP_COLORS: {
    survey: "rgba(120, 200, 190, 0.95)",
    fuel: "rgba(120, 220, 180, 0.95)",
    enemy: "rgba(200, 110, 110, 0.95)",
    asteroid: "rgba(210, 185, 150, 0.95)",
    chain: "rgba(120, 220, 255, 0.95)",
    gate: "rgba(170, 210, 220, 0.95)",
    generic: "rgba(230, 240, 240, 0.95)"
  }
};

// Resource pickups dropped by asteroids.
const RESOURCE = {
  DROP_CHANCE: 0.75,
  DROP_BASE_VALUE: 10,
  CHILD_VALUE_DECAY: 5,
  MIN_DROP_VALUE: 1,
  PICKUP_RADIUS: 18,
  SPRITE_SRC: "assets/ui/sprites/crystal.png",
  HUD_ICON_SIZE: 14,
  TTL_MS: 30000,
  RARITY_TIERS: 24,
  DROP_SKEW_EXPONENT: 4.5,
  VALUE_BASE: 1.18,
  LEGENDARY_THRESHOLD: 17,
  MYTHIC_INDEX: 23,
  LOW_TIER_REMAP: {
    0: 1,
    1: 2,
    2: 2,
    3: 3
  },
  VISUAL: {
    HL_THRESH_LOW: 0.65,
    HL_THRESH_HIGH: 0.9,
    CORE_BRIGHT_MULT: 1.25,
    CORE_ADD: 0.05,
    BASE_TINT_ALPHA: 0.7,
    CORE_TINT_ALPHA: 0.75,
    ROT_FREQ: 1.1,
    ROT_AMP: 0.1,
    BOB_FREQ: 1.6,
    BOB_AMP: 2.0,
    HALO_PULSE_FREQ: 0.8,
    HALO_ALPHA_LEGENDARY: 0.2,
    HALO_ALPHA_MYTHIC: 0.3,
    HALO_SCALE_LEGENDARY: 1.35,
    HALO_SCALE_MYTHIC: 1.55,
    SHADOW_ALPHA: 0.18,
    SHADOW_SCALE: 1.3
  },
  COLOR_ANCHORS: [
    { index: 0, hue: 0, sat: 0.0, val: 0.6 },
    { index: 5, hue: 120, sat: 0.6, val: 0.7 },
    { index: 9, hue: 210, sat: 0.7, val: 0.8 },
    { index: 13, hue: 270, sat: 0.75, val: 0.85 },
    { index: 17, hue: 45, sat: 0.8, val: 0.9 },
    { index: 23, hue: 0, sat: 0.9, val: 1.0 }
  ]
};

// Upgrade economy and effects.
const UPGRADES = {
  FIRE_RATE: {
    baseCost: 30,
    costGrowth: 1.45,
    effect: {
      cooldownMsBase: 260,
      cooldownMsMin: 90,
      model: {
        effectStep: 5,
        curveK: 0.1
      }
    }
  },
  FIRE_DISTANCE: {
    baseCost: 34,
    costGrowth: 1.45,
    effect: {
      multiplierBase: 0.5,
      multiplierMax: 2.0,
      model: {
        effectStep: 0.05,
        curveK: 0.12
      }
    }
  },
  SCAN_DISTANCE: {
    baseCost: 36,
    costGrowth: 1.45,
    effect: {
      stepsPerLevel: 1
    }
  },
  HULL: {
    baseCost: 25,
    costGrowth: 1.42,
    effect: {
      maxLivesBase: GAMEPLAY.STARTING_LIVES,
      armorBase: 0,
      armorMax: 3
    }
  },
  COLLECTOR: {
    baseCost: 20,
    costGrowth: 1.4,
    effect: {
      radiusBase: 0,
      pullStrengthBase: 0,
      pullStrengthMax: 0.2
    },
    models: {
      radius: {
        maxEffect: 280,
        effectStep: 2,
        curveK: 0.1
      },
      pullStrength: {
        maxEffect: 0.2,
        effectStep: 0.002,
        curveK: 0.075
      }
    }
  },
  FUEL_TANK: {
    baseCost: 100,
    costGrowth: 1.5,
    effect: {
      extraCapacityModel: {
        maxEffect: 1000,
        effectStep: 10,
        curveK: 0.1
      }
    }
  },
  REFUEL: {
    costPerFuel: 0.2
  },
  REPAIR: {
    baseCost: 12,
    costPerArmor: 8
  }
};

// Beacon exposure system.
const BEACON = {
  OBSERVER_RADIUS: 900,
  MIN_STAR_DIST: 300,
  OBSERVE_RATE: 0.00002,
  RETURN_BONUS: 0.02,
  SURVEY_BONUS: 0.05,
  MIDCYCLE_PENALTY: 0.03,
  VISIT_COOLDOWN: 600,
  SIGNAL_CYCLE: 60
};

// Calibration gates and sizing reference.
const CALIBRATION = {
  // Ship radius reference for gate sizing, not the collision radius.
  SHIP_RADIUS: 24,
  GATE: {
    SPAWN_MIN: 2,
    SPAWN_MAX: 7,
    FADE_TIME: 1.5,
    LIFETIME: 40,
    EXCLUSION_RADIUS: 220,
    CRUISE_MIN: 180,
    CRUISE_MAX: 260,
    CRUISE_SPEED: 220,
    SPAWN_LATERAL: 220,
    BASE_THICKNESS: 2,
    POLE_RATIO: 0.14,
    EDGE_OFFSET: 60,
    BASE_VIEW_RADIUS: 900,
    CHAIN_MIN: 3,
    CHAIN_MAX: 9,
    CHAIN_ARC_MIN: Math.PI / 10,
    CHAIN_ARC_MAX: Math.PI / 5,
    CHAIN_HUE_FALLOFF: 0.6,
    GATE_SCORE_BASE: 10,
    CHAIN_SCORE_BASE: 10,
    CHAIN_ATTEMPTS: 6,
    WEIGHTS: {
      CHAIN_GATE: 0.5,
      EXIT_ALIGNMENT_GATE: 0.25,
      DISPLACEMENT_GATE: 0.15,
      SHUTDOWN_GATE: 0.1
    },
    TYPES: {
      CHAIN: "CHAIN_GATE",
      DISPLACEMENT: "DISPLACEMENT_GATE",
      EXIT: "EXIT_ALIGNMENT_GATE",
      SHUTDOWN: "SHUTDOWN_GATE"
    },
    COLORS: {
      CHAIN: "rgba(80, 200, 255, 0.7)",
      DISPLACEMENT: "rgba(200, 120, 255, 0.7)",
      EXIT: "rgba(255, 190, 90, 0.7)",
      SHUTDOWN: "rgba(220, 70, 70, 0.75)"
    },
    WIDTH_MULTIPLIERS: {
      CHAIN_GATE: 1.6,
      DISPLACEMENT_GATE: 2.2,
      EXIT_ALIGNMENT_GATE: 1.3,
      SHUTDOWN_GATE: 2.0
    }
  }
};

// Upgrade station placement and safe zone rules.
const STATION = {
  SPRITE_SRC: "assets/ui/sprites/upgrade_station.png",
  SAFE_ZONE_RADIUS: 140,
  COLLIDER_RADIUS: 50,
  SPRITE_SCALE: 2,
  WAVE_PERIOD: 2.4,
  WAVE_EXPAND_RATIO: 0.2,
  WAVE_ALPHA: 0.22,
  DOCK_RADIUS: 65,
  DOCK_PULL_STRENGTH: 0.09,
  DOCK_DAMPING: 0.9,
  RIVER_NEGATION_RADIUS: 140,
  ENEMY_REPEL_RADIUS: 160,
  ENEMY_REPEL_STRENGTH: 0.12,
  SCAN_RANGE_CELLS: 5,
  UNIQUE_GRID_SIZE: 5,
  START_STATION_TIER_CAP: 3,
  MARKER_EDGE_INDICATOR: true,
  PLACEMENT_CHANCE_BASE: 0.05,
  PLACEMENT_CHANCE_RING_SCALE: 0.015
};

// Background layers and transient events.
const BACKGROUND = {
  STARFIELD: {
    DENSITY: 0.002,
    ALPHA: 0.45,
    BRIGHTNESS_MIN: 180,
    BRIGHTNESS_MAX: 255,
    PARALLAX: 0.03
  },
  DUSTFIELD: {
    DENSITY: 0.0012,
    ALPHA: 0.22,
    BRIGHTNESS_MIN: 80,
    BRIGHTNESS_MAX: 160,
    PARALLAX: 0.015
  },
  FARFIELD: {
    DENSITY: 0.0007,
    ALPHA: 0.18,
    BRIGHTNESS_MIN: 110,
    BRIGHTNESS_MAX: 190,
    PARALLAX: 0.008
  },
  SLICE: {
    DENSITY: 0.001,
    ALPHA: 0.22,
    ROT_SPEED: 0.00005,
    PARALLAX: 0.01,
    ARC: Math.PI * 1.1
  },
  EVENTS: {
    MIN_INTERVAL: 3.5,
    MAX_INTERVAL: 7.5,
    MAX_ACTIVE: 5,
    EDGE_MARGIN: 80,
    CLUSTER_CHANCE: 0.35,
    CLUSTER_MIN: 2,
    CLUSTER_MAX: 3,
    CLUSTER_OFFSET: 140
  },
  PALETTE: [
    [255, 80, 220],
    [80, 240, 255],
    [200, 255, 90],
    [255, 150, 60],
    [160, 90, 255],
    [255, 90, 140]
  ],
  NEBULA: {
    ALPHA: 0.2,
    ROT_SPEED: 0.00003,
    PARALLAX: 0.006,
    RADIUS_SCALE: 0.6,
    RING_WIDTH: 0.16,
    BLOB_COUNT: 28
  }
};

// Particle and trail effects.
const EFFECTS = {
  THRUST_PARTICLES: {
    RATE: 36,
    SPEED_MIN: 40,
    SPEED_MAX: 140,
    LIFE_MIN: 0.18,
    LIFE_MAX: 0.45,
    SIZE_MIN: 1.4,
    SIZE_MAX: 3.2,
    SPREAD: 0.45,
    OFFSET: 12
  },
  TRAIL_SPARKS: {
    RATE: 18,
    SPEED_MIN: 30,
    SPEED_MAX: 160,
    LIFE_MIN: 0.12,
    LIFE_MAX: 0.4,
    SIZE_MIN: 1.1,
    SIZE_MAX: 2.8,
    SPREAD: 0.8,
    OFFSET: 10
  },
  TRAIL_DISPERSE: {
    BASE_WIDTH: 3,
    SPREAD: 10
  },
  TRAIL_COLOR: {
    SPEED: 520,
    SLOW: [90, 140, 220],
    FAST: [200, 240, 255]
  },
  CONTROL_DISABLE: {
    DURATION: 10,
    PULSE_MIN: 0.25,
    PULSE_MAX: 0.6
  }
};

// Input tuning.
const INPUT = {
  TOUCH: {
    DEADZONE: 12,
    BUTTON_SCALE: 2,
    THRUST_RADIUS_MIN: 15,
    THRUST_RADIUS_MAX: 30,
    THRUST_RADIUS_SCALE: 0.04,
    FIRE_RADIUS_MIN: 15,
    FIRE_RADIUS_MAX: 30,
    FIRE_RADIUS_SCALE: 0.04,
    THRUST_ZONE_X: 0.5,
    THRUST_ZONE_Y: 0.55,
    FIRE_ZONE_X: 0.5,
    FIRE_ZONE_Y: 0.55,
    THRUST_HINT_X: 0.18,
    THRUST_HINT_Y: 0.78,
    FIRE_BUTTON_X: 0.82,
    FIRE_BUTTON_Y: 0.78,
    RETICLE_ENABLED: true,
    RETICLE_ALPHA: 0.22,
    RETICLE_LENGTH: 18,
    RETICLE_RADIUS: 4,
    HINT_ALPHA: 0.18,
    ACTIVE_ALPHA: 0.45,
    SHOW_HINTS: true,
    PINCH_ENABLED: true
  }
};

// Autopilot behavior and HUD toggle.
  const AUTOPILOT = {
    DEMO_SEED: 1357913579,
    BUTTON: {
      WIDTH: 140,
      HEIGHT: 34,
      Y_OFFSET: 22
    },
    SPEED_MAX: 200,
    COURSE: {
      LOOKAHEAD_DIST: 1200,
      LOOKAHEAD_TIME_MAX: 5,
      CORRIDOR_RADIUS: 40,
      AVOID_ANGLE_DEG: 16,
      ERROR_BLEND_RATIO: 0.2,
      TURN_EPSILON: 0.04
    },
    COLORS: {
      ON_FILL: "rgba(120, 210, 190, 0.35)",
      OFF_FILL: "rgba(40, 60, 70, 0.25)",
      BORDER: "rgba(170, 210, 220, 0.7)",
      ON_TEXT: "rgba(220, 250, 240, 0.95)",
    OFF_TEXT: "rgba(140, 170, 180, 0.7)",
    GLOW: "rgba(120, 220, 190, 0.6)"
  },
  ALERTS: {
    ENGAGED: "AUTOPILOT ENGAGED",
    DISENGAGED: "AUTOPILOT DISENGAGED"
  },
  FIRE: {
    CONE_DEG: 25,
    RANGE_MULT: 0.9,
    PAUSE_MIN: 0.15,
    PAUSE_MAX: 0.35,
    HAZARD_CLEAR_DIST: 220,
    PRIORITY_RANGE: 900,
    PRIORITY_REAR_ANGLE_DEG: 120
  },
    FUEL: {
      HIGH: 0.6,
      MID: 0.3,
      CRITICAL: 0.15
    },
    AVOID: {
      STAR_BODY_BUFFER: 40,
      ASTEROID_BODY_BUFFER: 30,
      STATION_BUFFER: 80,
      BEACON_BUFFER: 140
    },
    TARGET: {
      FUEL_RANGE: 1200,
      FUEL_ANGLE_DEG: 40,
      BRAKE_DISTANCE: 260,
      THRUST_ANGLE_DEG: 50
    },
    THRUST: {
      CRUISE_SPEED: 200,
      SPEED_FLOOR: 130,
      COAST_TIME: 1.6,
      BURST_MIN: 0.25,
      BURST_COOLDOWN: 0,
      ALIGN_POWER: 1.6,
      MIN_POWER: 0.35,
      ERROR_RATIO_DEADBAND: 0.035
    },
    GRAVITY: {
      COMPENSATION: 0.7,
      MAX_BLEND: 0.6,
      THRUST_RATIO: 0.6,
      CLOSE_PUSH: 0.9
    },
    RIVER: {
      ALIGN_DOT_MIN: 0.45
    }
  };

// HUD look and feel.
const HUD = {
  FONT: "'Orbitron', 'Bank Gothic', 'Eurostile', 'Consolas', monospace",
  ALERT: {
    DURATION: 2,
    FADE: 0.25
  },
  COLORS: {
    PANEL_START: "rgba(8, 12, 16, 0.9)",
    PANEL_END: "rgba(14, 24, 28, 0.82)",
    PANEL_STROKE: "rgba(120, 170, 180, 0.55)",
    PANEL_TICK: "rgba(200, 220, 220, 0.18)",
    PANEL_TEXT: "rgba(230, 240, 240, 0.95)",
    PANEL_MUTED: "rgba(170, 188, 194, 0.7)",
    ACCENT: "rgba(120, 200, 190, 0.95)",
    ACCENT_SOFT: "rgba(120, 200, 190, 0.35)",
    ACCENT_GLOW: "rgba(120, 200, 190, 0.55)",
    WARM: "rgba(210, 185, 150, 0.95)",
    WARNING: "rgba(210, 130, 120, 0.95)",
    ENEMY: "rgba(200, 110, 110, 0.9)",
    ASTEROID: "rgba(180, 185, 190, 0.4)",
    MAP_BG: "rgba(6, 10, 12, 0.65)",
    MAP_COMPLETE: "rgba(100, 170, 160, 0.1)",
    ALERT_STROKE: "rgba(6, 10, 12, 0.75)"
  },
  MINIMAP: {
    SIZE: 200,
    RANGE: 3000,
    SWEEP_SPEED: 0.0014,
    SWEEP_WIDTH: Math.PI / 12
  },
  COMPASS: {
    WIDTH: 320,
    HEIGHT: 78,
    Y_OFFSET: 55,
    FOV: Math.PI,
    TICK_DEG: 15
  },
  BEARING: {
    RADIUS: 36,
    CHEVRON_LENGTH: 9,
    CHEVRON_WIDTH: 5,
    CHEVRON_GAP: 7,
    DRIFT_AMPLITUDE: 4,
    DRIFT_SPEED: 0.0035,
    PULSE_SPEED: 0.0045,
    FUEL_SIZE: 3,
    SCAN_PRIMARY_ALPHA: 0.8,
    SCAN_SECONDARY_ALPHA: 0.45,
    FUEL_ALPHA: 0.3,
    DANGER_ALPHA: 0.85,
    DANGER_PULSE_SPEED: 0.012,
    DANGER_FLICKER_SPEED: 0.045,
    DANGER_DRIFT_SPEED: 0.006,
    FUEL_MAX_DOTS: 3
  },
    SCAN_PULSE: {
      PERIOD: 2400,
      RADIUS_MIN: 16,
      RADIUS_MAX: 160,
      LINE_WIDTH: 2
    },
    STATUS: {
      PANEL_WIDTH: 230,
      PANEL_WIDTH_COMPACT: 200,
      ROW_HEIGHT: 24,
      ROW_HEIGHT_COMPACT: 19,
      ICON_SIZE: 16,
      ICON_SIZE_COMPACT: 13,
      VALUE_FONT: 16,
      VALUE_FONT_COMPACT: 13,
      VALUE_GLOW: 10
    }
  };

// UI-specific endpoints and thresholds.
const UI = {
  SCOREBOARD: {
    ENDPOINT: "/api/score/",
    MIN_QUALIFY_SCORE: 100,
    NAME_MAX_LENGTH: 12
  }
};

// Narrative clue display tuning.
const CLUES = {
  SPEAKER_COLORS: {
    Harmon: "#D6B36A",
    Ezra: "#6FA9A5",
    Clara: "#C8C8C2",
    Marcus: "#5e748a",
    Noah: "#8A4A4A",
    Miriam: "#9A8FB3"
  },
  TUTORIAL_COLOR: "#FFFFFF",
  ALERT_DURATION: 8
};

// Physics constants.
const PHYSICS = {
  GRAVITY_G: 4000,
  SOFTENING: 80,
  DAMPING: 0.999
};

// Player projectile tuning.
const BULLET = {
  SPEED: 900,
  LIFE: 1.2,
  COOLDOWN: 0.26,
  FIRE_LOCKOUT: 0.5
};

// Player ship tuning and visuals.
const SHIP = {
  ROT_SPEED: 2.5,
  THRUST: 200,
  MAX_FUEL: 400,
  THRUST_FUEL_RATE: 18,
  ROT_FUEL_RATE: 0,
  DRAW_SIZE: 36,
  COLLISION_RADIUS: 12,
  SPRITE_SRC: "assets/ui/sprites/ship.png",
  THRUST_LOOP_SEGMENT: 0.4,
  THRUST_LOOP_CROSSFADE: 0.16,
  THRUST_VISUAL: {
    PLUME_BASE: 14,
    PLUME_MAX: 32,
    PLUME_SPEED: 22,
    PLUME_WIDTH: 9,
    KICK_DURATION: 0.14,
    KICK_RADIUS: 10,
    KICK_ALPHA: 0.65,
    SHIMMER_COUNT: 3,
    SHIMMER_LENGTH: 16,
    SHIMMER_WIDTH: 2.6,
    FLARE_RADIUS: 12,
    FLARE_ALPHA: 0.25
  },
  TRAIL: {
    MAX: 200,
    MIN_DIST: 6,
    FADE_SPEED: 24,
    FADE_STEP: 0.02
  }
};

// Enemy ship tuning and spawn behavior.
const ENEMY = {
  ROT_SPEED: 2.5,
  THRUST: 120,
  MAX_SPEED: 180,
  STRAFE_RANGE: 520,
  STRAFE_BUFFER: 90,
  DRAW_SIZE: 36,
  SPRITE_SRC: "assets/ui/sprites/enemy_ship.png",
  HIT_RADIUS: 12,
  FIRE_COOLDOWN: BULLET.COOLDOWN * 2,
  SPAWN_MARGIN: 120,
  RANGE_SCALE: 2 / 3
};

// Pickup visuals and spawn tuning.
const PICKUPS = {
  FUEL: {
    AMOUNT_RATIO: 1.0,
    WIDTH: 12,
    HEIGHT: 24,
    RADIUS: 14,
    DROP_CHANCE: 1 / 5,
    TTL_MS: 30000,
    ROT_SPEED_MIN: 0.5,
    ROT_SPEED_MAX: 1.1,
    SPRITE_SRC: "assets/ui/sprites/fuel.png"
  },
  ENEMY_CHUNK: {
    COUNT_MIN: 5,
    COUNT_MAX: 9,
    SPEED_MIN: 90,
    SPEED_MAX: 240,
    SIZE_MIN: 8,
    SIZE_MAX: 16,
    LIFE_MIN: 0.5,
    LIFE_MAX: 1.2,
    ROT_SPEED_MIN: 2.0,
    ROT_SPEED_MAX: 5.0,
    SPRITE_SRC: "assets/ui/sprites/enemy_chunk.png"
  }
};

// Sector object tuning and droppable upgrades.
const OBJECTS = {
  SPAWN_MARGIN: 160,
  STAR_PADDING: 120,
  CORE: {
    SPAWN_CHANCE: 0.15,
    SPRITE_SRC: "assets/ui/sprites/core.png",
    SIZE: 70,
    RADIUS: 34,
    ROT_SPEED_MIN: 0.12,
    ROT_SPEED_MAX: 0.26,
    SHOTS_TO_DESTROY: 1
  },
  LURE: {
    SPAWN_CHANCE: 0.05,
    SPRITE_SRC: "assets/ui/sprites/lure.png",
    SIZE: 60,
    RADIUS: 30,
    ROT_SPEED_MIN: 0.08,
    ROT_SPEED_MAX: 0.18,
    SHOTS_TO_DESTROY: 1,
    ENEMY_MIN: 1,
    ENEMY_MAX: 3,
    SPAWN_BUFFER: 120
  },
  WRECKAGE: {
    SPAWN_CHANCE: 0.1,
    SPRITE_SRC: "assets/ui/sprites/wreckage.png",
    SIZE: 64,
    RADIUS: 32,
    ROT_SPEED_MIN: 0.06,
    ROT_SPEED_MAX: 0.14,
    SHOTS_TO_DESTROY: 1
  },
  NODE: {
    SPAWN_CHANCE: 0.15,
    SPRITE_SRC: "assets/ui/sprites/node.png",
    SIZE: 52,
    RADIUS: 26,
    ROT_SPEED_MIN: 0.08,
    ROT_SPEED_MAX: 0.16,
    FOLLOW_TIME_SEC: 300,
    MIN_DISTANCE: 30,
    MAX_SPEED: 90,
    ACCEL: 140,
    TURN_RATE: 1.6,
    INVESTIGATE_TIME_SEC: 10,
    LEAVE_SPEED: 120
  },
  SHARD: {
    SPAWN_CHANCE: 0.2,
    SPRITE_SRC: "assets/ui/sprites/shard.png",
    SIZE: 48,
    RADIUS: 22,
    ROT_SPEED_MIN: 1.6,
    ROT_SPEED_MAX: 3.2,
    SHOTS_TO_DESTROY: 1,
    GLOW_COLOR: "rgba(180, 220, 255, 0.75)",
    GLOW_ALPHA: 0.35,
    GLOW_SCALE: 1.8
  },
  DROPPABLES: {
    RELIC: {
      SPRITE_SRC: "assets/ui/sprites/relic_droppable.png",
      RADIUS: 18,
      ROT_SPEED_MIN: 0.6,
      ROT_SPEED_MAX: 1.2,
      BOB_FREQ: 1.4,
      BOB_AMP: 3.0
    },
    SHARD: {
      SPRITE_SRC: "assets/ui/sprites/shard_droppable.png",
      RADIUS: 18,
      ROT_SPEED_MIN: 0.6,
      ROT_SPEED_MAX: 1.2,
      BOB_FREQ: 1.4,
      BOB_AMP: 3.0
    },
    NODE: {
      SPRITE_SRC: "assets/ui/sprites/node_droppable.png",
      RADIUS: 18,
      ROT_SPEED_MIN: 0.6,
      ROT_SPEED_MAX: 1.2,
      BOB_FREQ: 1.4,
      BOB_AMP: 3.0
    }
  },
  EXPLOSION_RING: {
    BASE_RADIUS: 60,
    LIFE: 0.45,
    WIDTH: 6,
    COLOR: "rgba(255, 80, 80, 0.4)",
    CORE_MULT: 3.0
  }
};

// Beacon relic visual defaults.
const BEACON_RELIC = {
  SPRITE_SRC: "assets/ui/sprites/beacon.png",
  SIZE: 180,
  SHIMMER_SPEED: 0.35,
  ROT_SPEED: 0.18,
  PULSE_AMOUNT: 0.04,
  PULSE_ALPHA: 0.12
};

// Lore point / survey target tuning.
const GOAL = {
  SPRITE_SRC: "assets/ui/sprites/page.png",
  WIDTH: 18,
  HEIGHT: 36,
  MARGIN: 300,
  MIN_SHIP_DIST: 900,
  MIN_STAR_DIST: 300,
  ROT_SPEED_MIN: 0.28,
  ROT_SPEED_MAX: 0.7,
  ANCHOR_RADIUS_DEFAULT: 480,
  GLOW_COLOR: "rgba(120, 200, 255, 0.85)",
  GLOW_ALPHA: 0.85,
  GLOW_BLUR: 18,
  GLOW_SCALE: 1.25,
  GLOW_PULSE_SPEED: 0.006,
  GLOW_PULSE_AMOUNT: 0.08
};

// End zone visuals and sizing.
const END_ZONE = {
  SPRITE_SRC: "assets/ui/sprites/scan_point.png",
  WIDTH: 30,
  HEIGHT: 16,
  MARGIN: 120,
  MIN_GOAL_DIST: 600,
  MIN_STAR_DIST: 300,
  ROT_SPEED: 2.2,
  PULSE_SPEED: 3.2,
  PULSE_AMOUNT: 0.08
};

// Asteroid visuals and generation tuning.
const ASTEROID = {
  SPRITE_SRC: "assets/ui/sprites/asteroid.png",
  CHUNK_SPRITE_SRC: "assets/ui/sprites/asteroid_chunk.png",
  ROT_SPEED_MIN: 0.05,
  ROT_SPEED_MAX: 0.18,
  FRAGMENTS: {
    TTL_MS: 10000,
    MAX_PER_SECTOR: 60
  },
  GENERATION: {
    COUNT: 30,
    SPEED_MIN: 5,
    SPEED_MAX: 60,
    RADIUS_MIN: 10,
    RADIUS_MAX: 33,
    SPAWN_MARGIN: 200,
    CLUSTER: {
      COUNT_MIN: 2,
      COUNT_MAX: 3,
      RADIUS_MIN: 220,
      RADIUS_MAX: 520
    }
  }
};

// Star visuals and generation tuning.
const STAR = {
  SPRITES: {
    yellow: "assets/ui/sprites/yellow_star.png",
    red: "assets/ui/sprites/red_star.png",
    blue: "assets/ui/sprites/blue_star.png"
  },
  DEFAULTS: {
    MASS: 1500,
    BODY_RADIUS: 60,
    BODY_COLOR: "gold",
    WELL_FILL: "rgba(255, 255, 200, 0.06)",
    WELL_STROKE: "rgba(255, 255, 200, 0.2)",
    MINIMAP_COLOR: "gold",
    SPRITE_KEY: "yellow",
    GRAVITY_RADIUS_MULTIPLIER: 3,
    PULSE_SPEED: 1.0,
    PULSE_AMOUNT: 0.06
  },
  GENERATION: {
    MASS_MIN: 1200,
    MASS_MAX: 2200,
    MARGIN: 400,
    BODY_RADIUS: 42,
    WELL: {
      BASE_RADIUS: 441,
      VARIANCE: 0.2
    },
    ROTATION: {
      YELLOW_MIN: 0.25,
      YELLOW_MAX: 0.35,
      RED_MIN: 0.4,
      RED_MAX: 0.55,
      BLUE_MIN: 0.6,
      BLUE_MAX: 0.8
    },
    PULSE: {
      YELLOW_SPEED_MIN: 0.7,
      YELLOW_SPEED_MAX: 1.0,
      RED_SPEED_MIN: 0.9,
      RED_SPEED_MAX: 1.2,
      BLUE_SPEED_MIN: 1.1,
      BLUE_SPEED_MAX: 1.5,
      YELLOW_AMOUNT: 0.05,
      RED_AMOUNT: 0.08,
      BLUE_AMOUNT: 0.12
    },
    TYPES: {
      yellow: {
        id: "yellow",
        bodyColor: "gold",
        wellFill: "rgba(255, 255, 200, 0.06)",
        wellStroke: "rgba(255, 255, 200, 0.2)",
        minimapColor: "gold",
        spriteKey: "yellow",
        wellMultiplier: 1.3,
        massMultiplier: 2.5
      },
      red: {
        id: "red",
        bodyColor: "#ff4d4d",
        wellFill: "rgba(255, 80, 80, 0.06)",
        wellStroke: "rgba(255, 80, 80, 0.2)",
        minimapColor: "#ff6b6b",
        spriteKey: "red",
        wellMultiplier: 1.0,
        massMultiplier: 1.0
      },
      blue: {
        id: "blue",
        bodyColor: "#66ccff",
        wellFill: "rgba(120, 180, 255, 0.06)",
        wellStroke: "rgba(120, 180, 255, 0.2)",
        minimapColor: "#7ad2ff",
        spriteKey: "blue",
        wellMultiplier: 1.69,
        massMultiplier: 4.0
      },
      singularity: {
        id: "singularity",
        bodyColor: "rgb(12, 12, 18)",
        wellFill: "rgba(20, 22, 30, 0.18)",
        wellStroke: "rgba(80, 90, 120, 0.22)",
        minimapColor: "rgb(80, 90, 120)",
        spriteKey: "singularity",
        wellMultiplier: 2.8,
        massMultiplier: 6.5
      }
    },
    RATE_MULTIPLIER: 3,
    PLACEMENT: {
      MAX_TRIES_PER_STAR: 18,
      MAX_CONSECUTIVE_FAILURES: 6
    }
  },
  MOTION: {
    SAFETY_BUFFER: 120
  }
};

// Field composition that shapes spatial layouts across many sectors.
const FIELD = {
  SIZE_SECTORS: 8,
  TYPES: {
    GEOMETRIC_LATTICE: "GEOMETRIC_LATTICE",
    GEOMETRIC_RADIAL: "GEOMETRIC_RADIAL",
    BRAIDED_FLOW: "BRAIDED_FLOW",
    SPARSE_VOID: "SPARSE_VOID",
    CHAOTIC_CLUSTER: "CHAOTIC_CLUSTER"
  },
  STAR_MULTIPLIERS: {
    GEOMETRIC_LATTICE: 1.0,
    GEOMETRIC_RADIAL: 0.95,
    BRAIDED_FLOW: 0.9,
    SPARSE_VOID: 0.2,
    CHAOTIC_CLUSTER: 1.1
  },
  VOID_ALLOWED_MAX_RING: 6,
  VOID_ZERO_STAR_PROB: 0.55
};

// Space river network and force tuning.
const RIVER = {
  WIDTH_MIN: 120,
  WIDTH_MAX: 900,
  STRENGTH_BASE: 23.3,
  STRENGTH_MULTIPLIER: 3,
  STRENGTH_EXPONENT: 1.0,
  EDGE_FALLOFF_POWER: 2.0,
  TIME_SCALE: 1.0,
  VS_STAR_RATIO_MAX: 0.6,
  WORLD_DENSITY: 0.22,
  MIN_PER_SECTOR: 2,
  PER_SECTOR_MAX: 2,
  CHANNEL_SECTOR_BIAS: 0.65,
  DISABLED_SECTOR_TYPES: ["SIGNAL_ORIGIN", "MERIDIAN"],
  POLYLINE_SPACING: 120,
  BACKBONE_SPAN_CELLS: 3,
  DRIFT_AMPLITUDE: 3.6,
  DRIFT_RATE: 0.03,
  ANCHOR: {
    CELL_SIZE_SECTORS: 12,
    SEARCH_RADIUS: 2.5,
    SNAP_RADIUS: 350
  },
  RENDER: {
    SHIMMER_RATE: 0.006,
    WAVE_AMPLITUDE: 18,
    WAVE_LENGTH: 420,
    WAVE_SPEED: 0.25,
    PULSE_RATE: 0.35,
    PULSE_AMOUNT: 0.2,
    BASE_COLOR_VARIANCE: 16,
    CHROMA_SPLIT: {
      OFFSETS: [-0.06, 0.06, 0.1],
      ALPHA: 0.06,
      WIDTH_SCALE: 0.16,
      COLORS: [
        [90, 210, 255],
        [255, 150, 220],
        [140, 255, 210]
      ]
    },
    FLOW_DASH: {
      LENGTH: 140,
      GAP: 220,
      WIDTH: 2.5,
      ALPHA: 0.14,
      SPEED: 0.6,
      COLOR: [210, 240, 255]
    },
    SCINTILLATION: {
      ENABLED: true,
      RATE: 0.18,
      WAVELENGTH: 220,
      STRENGTH: 0.6,
      HUE_SHIFT: 0.18
    },
    OUTER_ALPHA: 0.06,
    MID_ALPHA: 0.1,
    CORE_ALPHA: 0.14
  }
};

// Sector generation and persistence tuning.
const SECTOR = {
  SIZE: 6000,
  ENTRY_SAFE_RADIUS: 900,
  START_SAFE_RADIUS: 1600,
  RUNTIME_CACHE_RANGE: 3,
  BEACON_SAFE_PADDING: 320,
  MIN_ORIGIN_RING: 8,
  ORIGIN_COOLDOWN: 11,
  ECHO_MIN_EXPOSURE: 0.2,
    TYPES: {
      GENERIC: "GENERIC",
      DEAD_QUIET: "DEAD_QUIET",
      ECHO: "ECHO",
      ANOMALY: "ANOMALY",
      DERELICT_FIELD: "DERELICT_FIELD",
      SIGNAL_ORIGIN: "SIGNAL_ORIGIN",
      APSE: "APSE",
      QUIET_REACH: "QUIET_REACH",
      MERIDIAN: "MERIDIAN",
      PALIMPSEST: "PALIMPSEST"
    },
  MOODS: ["NEUTRAL", "QUIET", "UNSETTLING", "FAMILIAR", "ARTIFICIAL"],
  ANOMALY_MODIFIERS: [
    "SCANNER_JITTER",
    "RANGE_DRIFT",
    "ORIENTATION_DRIFT",
    "PULSE_GHOSTS"
  ],
  SPAWN_PROFILES: {},
    SEED_SALT: {
      TYPE: 101,
      MOOD: 202,
      ANOMALY: 303,
      ECHO: 404,
      BEACON: 505,
      STARS: 606,
      GOAL: 707,
      END_ZONE: 808,
      ASTEROIDS: 909,
      PATTERN: 955,
      FIELD: 1001,
      RIVER: 1111,
      ANCHOR: 1222,
      STATION: 1333,
      SPECIAL: 1444,
      MERIDIAN: 1555,
      OBJECTS_CORE: 1660,
      OBJECTS_LURE: 1661,
      OBJECTS_WRECKAGE: 1662,
      OBJECTS_NODE: 1663,
      OBJECTS_SHARD: 1664,
      OBJECTS_DROP: 1665
    },
  SIGNAL_ORIGIN: {
    FORCE_NEAR_ORIGIN: true,
    FORCE_SECTOR: { sx: 0, sy: -1 }
  },
  APSE: {
    RING_RADIUS_RATIO: 0.35,
    RING_THICKNESS_RATIO: 0.03,
    OPENING_ARC_DEG: 10,
    ARC_GAP_DEG: 12,
    SCAN_POINT_CENTERED: true,
    RENDER_MODE: "METAL",
    GEOMETRY_FILL: "rgba(120, 220, 255, 0.18)",
    GEOMETRY_STROKE: "rgba(120, 220, 255, 0.85)",
    GEOMETRY_STROKE_WIDTH: 4.0,
    GEOMETRY_GLOW: "rgba(120, 220, 255, 0.6)",
    GEOMETRY_GLOW_BLUR: 20,
    ROT_SPEED_MIN: 0.003,
    ROT_SPEED_MAX: 0.009,
    BOUNCE_FACTOR: 0.35,
    BOUNCE_DAMPING: 0.88,
    SPRITE_SRC: "assets/ui/sprites/apse_arc.png",
    SPRITE_CURVATURE_RADIUS: 477.2,
    SPRITE_CURVATURE_ANCHOR: { x: 768.6, y: 888.2 },
    SPRITE_ROT_OFFSET_DEG: 90,
    PORTAL_OFFSET_RATIO: 1.0,
    BACKGROUND: {
      TEXTURE_SIZE: 2048,
      EDGE_FADE_RATIO: 0.04,
      EDGE_FADE_ALPHA: 0.7,
      VOID_PROB_PRIMARY: 0.0,
      VOID_PROB_SECONDARY: 0.0,
      VOID_PROB_TERTIARY: 0.0,
      CUT_PROB_PRIMARY: 0.0,
      CUT_PROB_SECONDARY: 0.0,
      CUT_PROB_TERTIARY: 0.0,
      RING_GAP_RATIO: 0.02,
      COVERAGE_MIN: 0.92,
      COVERAGE_MAX: 0.97,
      BASE_FILL_COLOR: "rgb(30, 28, 40)",
      BASE_FILL_ALPHA: 1.0,
      PALETTE: [
        "rgb(120, 114, 98)",
        "rgb(96, 100, 106)",
        "rgb(130, 122, 106)",
        "rgb(98, 110, 116)",
        "rgb(112, 104, 88)",
        "rgb(138, 130, 118)"
      ],
      PRIMARY_PALETTE: [
        "rgb(196, 45, 52)",
        "rgb(233, 158, 54)",
        "rgb(38, 160, 155)",
        "rgb(28, 98, 198)",
        "rgb(58, 170, 96)",
        "rgb(214, 206, 186)"
      ],
      SECONDARY_PALETTE: [
        "rgb(170, 124, 74)",
        "rgb(124, 146, 166)",
        "rgb(156, 120, 170)",
        "rgb(152, 166, 120)",
        "rgb(182, 136, 112)"
      ]
    },
      METAL_TEXTURE: {
        ENABLED: true,
        TILE_SIZE: 256,
        BASE_COLOR: "rgb(60, 72, 88)",
        HIGHLIGHT_COLOR: "rgb(185, 200, 222)",
        SHADOW_COLOR: "rgb(20, 28, 44)",
        STREAK_COUNT: 260,
        STREAK_ALPHA: 0.35,
        STREAK_SLOPE: 0.18,
        GRAIN_ALPHA: 0.3,
        SPECKLE_ALPHA: 0.2,
        SPECKLE_COUNT: 650,
        CLOUD_COUNT: 24,
        CLOUD_ALPHA: 0.22,
        BAND_COUNT: 12,
        BAND_ALPHA: 0.18,
        BAND_WARP: 0.2,
        OUTER_ALPHA: 1.0,
        INNER_ALPHA: 1.0,
        RIB_ALPHA: 0.95,
        STROKE: "rgba(210, 220, 235, 0.8)",
        STROKE_WIDTH: 2.2
      },
    INTERIOR: {
      INNER_WALL_ENABLED: false,
      INNER_RADIUS_RATIO: 0.18,
      OUTER_INSET_RATIO: 1.6,
      BAND_COUNT: 3,
      BAND_THICKNESS_RATIO: 0.3,
      PRIMARY_WALL_MIN: 2,
      PRIMARY_WALL_MAX: 5,
      PRIMARY_ARC_MIN_DEG: 40,
      PRIMARY_ARC_MAX_DEG: 120,
      SECONDARY_WALL_MIN: 0,
      SECONDARY_WALL_MAX: 2,
      SECONDARY_ARC_MIN_DEG: 12,
      SECONDARY_ARC_MAX_DEG: 60,
      SECONDARY_THICKNESS_RATIO: 0.25,
      ANGLE_DIVS: 36,
      OPENING_GUARD_DEG: 6,
      ROT_SPEED_MIN: -0.002,
      ROT_SPEED_MAX: 0.002,
      ENTRY_LIP_INSET_RATIO: 0.0,
      ENTRY_LIP_THICKNESS_RATIO: 1.0,
      RENDER_MODE: "METAL",
      FORCEFIELDS: {
        PRIMARY: {
          color: "rgba(120, 220, 200, 0.28)",
          glow: "rgba(120, 220, 200, 0.7)",
          glowBlur: 18,
          stroke: "rgba(200, 255, 240, 0.6)",
          strokeWidth: 1.4
        },
        SECONDARY: {
          color: "rgba(110, 180, 255, 0.22)",
          glow: "rgba(110, 180, 255, 0.6)",
          glowBlur: 14,
          stroke: "rgba(180, 220, 255, 0.55)",
          strokeWidth: 1.2
        },
        ENTRY_LIP: {
          color: "rgba(200, 150, 255, 0.2)",
          glow: "rgba(200, 150, 255, 0.45)",
          glowBlur: 10,
          stroke: "rgba(220, 190, 255, 0.45)",
          strokeWidth: 1.0
        }
      },
      PRIMARY_SPRITE_SRC: "assets/ui/sprites/apse_arc.png",
      SECONDARY_SPRITE_SRC: "assets/ui/sprites/apse_arc.png",
      ENTRY_LIP_SRC: "assets/ui/sprites/apse_arc.png"
    },
    FORCE_NEAR_ORIGIN: false,
    FORCE_NEAR_ORIGIN_RING: 1,
    FORCE_SECTOR: { sx: 0, sy: -1 }
  },
    MERIDIAN: {
      FORCE_NEAR_ORIGIN: false,
      FORCE_SECTOR: { sx: 0, sy: -1 },
      SPINE_WIDTH_MULTIPLIER: 1.0,
      SPINE_CORE_COLOR: "rgba(210, 230, 255, 0.82)",
      SPINE_EDGE_COLOR: "rgba(245, 252, 255, 0.95)",
      SPINE_EDGE_WIDTH: 2.4,
      BOUNCE: 0.98,
      CHROMA_SPLIT_STRENGTH: 1.0,
      CHROMA_SPLIT_HUE: 60,
      CHROMA_SPLIT_SAT: 2.5,
      PARALLAX_SHEAR: 0.06,
      SILENCE_BAND_MULTIPLIER: 3.5,
      SILENCE_BAND_ALPHA: 0.6,
      SMEAR_BAND_MULTIPLIER: 3.8,
      SMEAR_STRETCH: 2.4,
      SMEAR_ALPHA: 0.45,
      TRACE_ENABLED: true,
      TRACE_BAND_MULTIPLIER: 0.65,
      TRACE_ALPHA: 0.55,
      TRACE_SPEED: 22,
      TRACE_SAT: 0.95,
      TRACE_LIGHT: 0.7,
      TRACE_LAYER_COUNT: 3
    },
    PALIMPSEST: {
      FORCE_NEAR_ORIGIN: false,
      FORCE_SECTOR: { sx: 0, sy: -1 },
      SINGULARITY: {
        RADIUS_RATIO: 0.08,
        GRAVITY_RATIO: 0.48,
        MASS_MULTIPLIER: 1.1,
        RIM_COLOR: "rgba(130, 150, 190, 0.55)",
        RIM_BRIGHT: "rgba(200, 220, 255, 0.8)",
        RIM_THICKNESS_RATIO: 0.01,
        SHIMMER_SPEED: 0.9,
        SHIMMER_AMOUNT: 0.7,
        FLASH_DURATION: 0.15,
        FLASH_ALPHA: 0.7,
        FLASH_ARC_SPAN_DEG: 70,
        FLASH_COLORS: [
          "rgba(255, 140, 120, 0.75)",
          "rgba(160, 210, 255, 0.75)",
          "rgba(200, 140, 255, 0.75)",
          "rgba(130, 255, 210, 0.75)"
        ]
      },
      FRAGMENTS: {
        SPRITES: [
          "assets/ui/sprites/pal_1.png",
          "assets/ui/sprites/pal_2.png",
          "assets/ui/sprites/pal_3.png",
          "assets/ui/sprites/pal_4.png",
          "assets/ui/sprites/pal_5.png",
          "assets/ui/sprites/pal_6.png"
        ],
        RADIUS_RATIO: 0.04,
        ORBIT_MIN_RATIO: 0.22,
        ORBIT_MAX_RATIO: 0.68,
        ORBIT_ECCENTRICITY: 0.12,
        ORBIT_SPEED_MIN: 0.012,
        ORBIT_SPEED_MAX: 0.028,
        SPIN_SPEED_MIN: 0.08,
        SPIN_SPEED_MAX: 0.22,
        BOUNCE: 0.82
      }
    },
  OCCLUSION: {
    ENABLED: true,
    DISABLED_SECTOR_TYPES: ["QUIET_REACH"],
    MERIDIAN_CHANCE_MULT: 0.35,
    PHASES: {
      ACT1: { PARTIAL: 0, FULL: 0 },
      ACT2: { PARTIAL: 0.35, FULL: 0.1 },
      ACT3: { PARTIAL: 0.2, FULL: 0.4 },
      ACT3_LATE: { PARTIAL: 0.2, FULL: 0.45 }
    },
    COLOR_SAT_MIN: 0.35,
    COLOR_SAT_MAX: 0.7,
    COLOR_LIGHT_MIN: 0.45,
    COLOR_LIGHT_MAX: 0.72,
    PARTIAL_PATCH_MIN: 5,
    PARTIAL_PATCH_MAX: 8,
    PARTIAL_RADIUS_MIN_RATIO: 0.12,
    PARTIAL_RADIUS_MAX_RATIO: 0.28,
    PARTIAL_SPEED_MIN_RATIO: 0.0015,
    PARTIAL_SPEED_MAX_RATIO: 0.004,
    PARTIAL_PATCH_ALPHA: 0.95,
    PARTIAL_CLEAR_RADIUS_RATIO: 0.12,
    PARTIAL_FADE_DISTANCE_RATIO: 0.35,
    PARTIAL_BASE_FOG_ALPHA: 0.15,
    PARTIAL_FOG_RADIUS_RATIO: 0.7,
    FULL_PATCH_MIN: 12,
    FULL_PATCH_MAX: 18,
    FULL_RADIUS_MIN_RATIO: 0.18,
    FULL_RADIUS_MAX_RATIO: 0.4,
    FULL_SPEED_MIN_RATIO: 0.002,
    FULL_SPEED_MAX_RATIO: 0.006,
    FULL_PATCH_ALPHA: 0.95,
    FULL_CLEAR_RADIUS_RATIO: 0.08,
    FULL_FOG_RADIUS_RATIO: 0.6,
    FULL_FOG_ALPHA: 0.65,
    FULL_FOG_COLOR: "rgba(10, 12, 18, 1)"
  },
  DRAG: {
    ENABLED: true,
    DISABLED_SECTOR_TYPES: [],
    MERIDIAN_CHANCE_MULT: 0.5,
    PHASES: {
      ACT1: { SINGLE: 0, LAYERED: 0, ALLOW_STACK: false },
      ACT2: { SINGLE: 0.18, LAYERED: 0, ALLOW_STACK: false },
      ACT3: { SINGLE: 0.2, LAYERED: 0.35, ALLOW_STACK: false },
      ACT3_LATE: { SINGLE: 0.2, LAYERED: 0.45, ALLOW_STACK: true }
    },
    SINGLE_FIELD_MIN: 1,
    SINGLE_FIELD_MAX: 2,
    LAYERED_FIELD_MIN: 3,
    LAYERED_FIELD_MAX: 5,
    RADIUS_MIN_RATIO: 0.18,
    RADIUS_MAX_RATIO: 0.5,
    DRAG_MIN: 0.94,
    DRAG_MAX: 0.985,
    BEACON_DRAG_SCALE: 0.45,
    NOISE_SCALE_RATIO: 0.2,
    FALLOFF_POWER: 1.7,
    TIME_SCALE: 60
  },
  ZONES: {
    start: { id: "start", asteroidMultiplier: 0.5 },
    middle: { id: "middle", asteroidMultiplier: 1.0 },
    outer: { id: "outer", asteroidMultiplier: 1.3 }
  }
};

SECTOR.SPAWN_PROFILES = {
  [SECTOR.TYPES.GENERIC]: {
    stars: 1.0,
    asteroids: 1.0,
    scanPoints: 1.0,
    hazards: 1.0
  },
  [SECTOR.TYPES.DEAD_QUIET]: {
    stars: 0.2,
    asteroids: 0.1,
    scanPoints: 0.2,
    hazards: 0.3
  },
  [SECTOR.TYPES.DERELICT_FIELD]: {
    stars: 0.8,
    asteroids: 1.4,
    scanPoints: 0.8,
    hazards: 1.2
  },
  [SECTOR.TYPES.ANOMALY]: {
    stars: 0.6,
    asteroids: 0.6,
    scanPoints: 1.2,
    hazards: 1.5
  },
  [SECTOR.TYPES.ECHO]: {
    stars: 1.0,
    asteroids: 1.0,
    scanPoints: 0.9,
    hazards: 1.0
  },
  [SECTOR.TYPES.SIGNAL_ORIGIN]: {
    stars: 0.4,
    asteroids: 0.05,
    scanPoints: 0.2,
    hazards: 0.6
  },
  [SECTOR.TYPES.APSE]: {
    stars: 0.0,
    asteroids: 0.0,
    scanPoints: 1.0,
    hazards: 0.0
  },
  [SECTOR.TYPES.QUIET_REACH]: {
    stars: 0.0,
    asteroids: 0.0,
    scanPoints: 1.0,
    hazards: 0.0
  },
  [SECTOR.TYPES.MERIDIAN]: {
    stars: 0.35,
    asteroids: 0.0,
    scanPoints: 1.0,
    hazards: 0.0
  },
  [SECTOR.TYPES.PALIMPSEST]: {
    stars: 0.0,
    asteroids: 1.0,
    scanPoints: 1.0,
    hazards: 0.0
  }
};

// Audio file map and music playlist.
const AUDIO = {
  SOUNDS: {
    start_game: { src: "assets/sounds/mp3/start_game.mp3", volume: 0.9 },
    laser: { src: "assets/sounds/mp3/laser.mp3", volume: 0.13 },
    enemy_laser: { src: "assets/sounds/mp3/laser.mp3", volume: 0.06},
    explosion: { src: "assets/sounds/mp3/explosion.mp3", volume: 0.75 },
    lost_life: { src: "assets/sounds/mp3/lost_life.mp3", volume: 0.9 },
    got_fuel: { src: "assets/sounds/mp3/got_fuel.mp3", volume: 0.8 },
    got_money: { src: "assets/sounds/mp3/got_money.mp3", volume: 0.85 },
    bought: { src: "assets/sounds/mp3/bought.mp3", volume: 0.85 },
    at_station: { src: "assets/sounds/mp3/at_station.mp3", volume: 0.45 },
    got_gate: { src: "assets/sounds/mp3/got_gate.mp3", volume: 1 },
    got_survey: { src: "assets/sounds/mp3/got_survey.mp3", volume: 0.7 },
    game_over: { src: "assets/sounds/mp3/game_over.mp3", volume: 0.6 },
    thrust: { src: "assets/sounds/mp3/thrust.mp3", volume: 0.4, loopMode: "native" },
    thrust_rotate: { src: "assets/sounds/mp3/thrust.mp3", volume: 0, loopMode: "native" }
  },
  MUSIC: {
    TRACKS: [
      "assets/sounds/mp3/1. failed_before.mp3",
      "assets/sounds/mp3/2. remind_me_later.mp3",
      "assets/sounds/mp3/3. take_it_easy.mp3",
      "assets/sounds/mp3/4. where_the_time_goes.mp3",
      "assets/sounds/mp3/5. the_noise_in_my_head.mp3",
      "assets/sounds/mp3/6. noonquil.mp3"
    ],
    VOLUME: 0.45
  },
  QUIET_REACH: {
    FADE_OUT_MS: 1200,
    FADE_IN_MS: 1200
  }
};

export const CONFIG = {
  STORAGE,
  DEBUG,
  CAMERA,
  GAMEPLAY,
  SCORE,
  RESOURCE,
  UPGRADES,
  BEACON,
  CALIBRATION,
  STATION,
  BACKGROUND,
  EFFECTS,
  INPUT,
  AUTOPILOT,
  HUD,
  CLUES,
  UI,
  PHYSICS,
  BULLET,
  SHIP,
  ENEMY,
  PICKUPS,
  OBJECTS,
  BEACON_RELIC,
  GOAL,
  END_ZONE,
  ASTEROID,
  STAR,
  FIELD,
  RIVER,
  SECTOR,
  AUDIO
};
