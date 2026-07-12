export function choice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sample(items, count) {
  return shuffle(items).slice(0, count);
}
