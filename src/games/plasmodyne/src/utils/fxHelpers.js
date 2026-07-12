export function cssColor(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function mapBackgroundPointToScreen(background, xNorm, yNorm) {
  const source = background.texture.source[0];
  const width = source.width * background.scaleX;
  const height = source.height * background.scaleY;
  return {
    x: background.x - width / 2 + width * xNorm,
    y: background.y - height / 2 + height * yNorm
  };
}

export function fitCoverImage(image, viewportWidth, viewportHeight) {
  const source = image.texture.source[0];
  const scale = Math.max(viewportWidth / source.width, viewportHeight / source.height);
  image.setPosition(viewportWidth / 2, viewportHeight / 2);
  image.setScale(scale);
}
