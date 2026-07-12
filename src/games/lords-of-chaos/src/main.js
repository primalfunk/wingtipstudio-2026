import { GameManager } from "./core/GameManager.js";
import { UI } from "./ui/UI.js";
import { SoundManager } from "./audio/SoundManager.js";

async function bootstrap() {
  const words = await fetch("assets/data/words.json").then((response) => response.json());
  const ui = new UI(words);
  const audio = new SoundManager();
  const game = new GameManager(words, { ui, audio });
  ui.bind(game);
  window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));

  function frame(now) {
    game.update(now);
    ui.draw(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

bootstrap();
