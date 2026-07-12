export function createDroidScanArcTexture(scene, key = 'droid-scan-arc') {
  if (scene.textures.exists(key)) {
    return key;
  }
  const size = 96;
  const canvas = scene.textures.createCanvas(key, size, size);
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(210, 248, 255, 0.72)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 39, 0, Math.PI * 2);
  ctx.stroke();
  canvas.refresh();
  return key;
}

export function createFixtureTextures(scene) {
  createDroidScanArcTexture(scene);
}
