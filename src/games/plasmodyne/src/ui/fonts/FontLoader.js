const FONT_SOURCES = [
  {
    family: 'Arbedo',
    urls: [
      './assets/fonts/arbedo/arbedo.otf'
    ]
  },
  {
    family: 'Grisha',
    urls: [
      './assets/fonts/grisha/grisha.ttf'
    ]
  },
  {
    family: 'MoonRunner',
    urls: [
      './assets/fonts/moon-runner/moon-runner.otf'
    ]
  },
  {
    family: 'MoonRunnerLaser',
    urls: [
      './assets/fonts/moon-runner/moon-runner-laser.otf'
    ]
  },
  {
    family: 'MoonRunner3D',
    urls: [
      './assets/fonts/moon-runner/moon-runner-3d.otf'
    ]
  },
  {
    family: 'MoonRunnerCondensed',
    urls: [
      './assets/fonts/moon-runner/moon-runner-condensed.otf'
    ]
  },
  {
    family: 'MoonRunnerExpanded',
    urls: [
      './assets/fonts/moon-runner/moon-runner-expanded.otf'
    ]
  },
  {
    family: 'MoonRunnerSquat',
    urls: [
      './assets/fonts/moon-runner/moon-runner-squat.otf'
    ]
  },
  {
    family: 'VakultaTrial',
    urls: [
      './assets/fonts/vakulta-trial/vakulta-trial.otf',
      './assets/fonts/vakulta-trial/vakulta-trial.ttf'
    ]
  },
  {
    family: 'RocketCommand',
    urls: [
      './assets/fonts/rocket-command/rocket-command.otf'
    ]
  },
  {
    family: 'RocketCommandCondensed',
    urls: [
      './assets/fonts/rocket-command/rocket-command-condensed.otf'
    ]
  },
  {
    family: 'RocketCommandExpanded',
    urls: [
      './assets/fonts/rocket-command/rocket-command-expanded.otf'
    ]
  },
  {
    family: 'RocketCommandLaser',
    urls: [
      './assets/fonts/rocket-command/rocket-command-laser.otf'
    ]
  },
  {
    family: 'Ethnocentric',
    urls: [
      './assets/fonts/ethnocentric/ethnocentric.woff2',
      './assets/fonts/ethnocentric/ethnocentric.woff',
      './assets/fonts/ethnocentric/ethnocentric.ttf'
    ]
  },
  {
    family: 'Orbitron',
    urls: [
      './assets/fonts/orbitron/orbitron.woff2',
      './assets/fonts/orbitron/orbitron.ttf'
    ]
  },
  {
    family: 'Michroma',
    urls: [
      './assets/fonts/michroma/michroma.woff2',
      './assets/fonts/michroma/michroma.ttf'
    ]
  }
];

export async function loadUiFonts() {
  if (!('fonts' in document) || typeof FontFace === 'undefined') {
    return { loaded: [], skipped: FONT_SOURCES.map((font) => font.family) };
  }

  const loaded = [];
  const skipped = [];
  for (const font of FONT_SOURCES) {
    const didLoad = await loadFirstAvailableSource(font.family, font.urls);
    if (didLoad) {
      loaded.push(font.family);
    } else {
      skipped.push(font.family);
    }
  }

  await document.fonts.ready;
  return { loaded, skipped };
}

async function loadFirstAvailableSource(family, urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }
      const fontData = await response.arrayBuffer();
      if (!isLikelyFont(fontData)) {
        continue;
      }
      const face = new FontFace(family, fontData);
      const loadedFace = await face.load();
      document.fonts.add(loadedFace);
      return true;
    } catch {
      // Missing local project fonts are expected until licensed font files are added.
    }
  }
  return false;
}

function isLikelyFont(buffer) {
  if (!buffer || buffer.byteLength < 4) {
    return false;
  }
  const bytes = new Uint8Array(buffer, 0, 4);
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  return tag === 'OTTO' ||
    tag === 'wOFF' ||
    tag === 'wOF2' ||
    (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
    (bytes[0] === 0x74 && bytes[1] === 0x72 && bytes[2] === 0x75 && bytes[3] === 0x65);
}
