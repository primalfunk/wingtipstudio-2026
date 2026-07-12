import { CSSProperties, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageMeta from "../components/PageMeta";
import { games, platformDetails, type PlatformCategory } from "../content/gameCatalog";



export default function ArcadeHome() {
  const navigate = useNavigate();
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [carouselIsMoving, setCarouselIsMoving] = useState(false);
  const switchSoundRef = useRef<HTMLAudioElement | null>(null);
  const selectedGame = games[selectedGameIndex];
  const particles = useMemo(
    () =>
      Array.from({ length: 84 }, (_, index) => ({
        id: index,
        style: {
          "--x": `${random(index, 1) * 100}%`,
          "--y": `${random(index, 2) * 100}%`,
          "--size": `${1 + random(index, 3) * 2.6}px`,
          "--delay": `${-random(index, 4) * 28}s`,
          "--duration": `${22 + random(index, 5) * 32}s`,
          "--opacity": `${0.06 + random(index, 6) * 0.16}`,
          "--particle-color":
            random(index, 7) > 0.94
              ? "245 209 95"
              : random(index, 8) > 0.52
                ? "35 217 196"
                : "178 86 214",
        } as CSSProperties,
      })),
    [],
  );

  useEffect(() => {
    document.body.classList.remove("is-launching-game");
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTyping || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusPreviousGame();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        focusNextGame();
      }

      if (event.key === "Enter" && !(target instanceof HTMLButtonElement)) {
        event.preventDefault();
        launchGame(selectedGame.path);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedGame.path]);

  useEffect(() => {
    if (!carouselIsMoving) {
      return;
    }

    const timeout = window.setTimeout(() => setCarouselIsMoving(false), 420);

    return () => window.clearTimeout(timeout);
  }, [carouselIsMoving, selectedGameIndex]);

  function handlePointerMove(event: MouseEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 10,
      y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 10,
    });
  }

  function launchGame(path: string) {
    document.body.classList.add("is-launching-game");
    window.setTimeout(() => navigate(path), 180);
  }

  function playCarouselSwitch() {
    switchSoundRef.current ??= new Audio("/assets/carousel_switch.mp3");
    const sound = switchSoundRef.current;
    sound.currentTime = 0;
    sound.volume = 0.65;
    void sound.play().catch(() => {
      // Browsers can block audio until the first user gesture; carousel still works.
    });
  }

  function selectGame(index: number) {
    const nextIndex = loopIndex(index);

    if (nextIndex === selectedGameIndex) {
      return;
    }

    setCarouselIsMoving(true);
    playCarouselSwitch();
    setSelectedGameIndex(nextIndex);
  }

  function focusPreviousGame() {
    selectGame(selectedGameIndex - 1);
  }

  function focusNextGame() {
    selectGame(selectedGameIndex + 1);
  }

  function getCarouselOffset(index: number) {
    const rawOffset = index - selectedGameIndex;
    const half = Math.floor(games.length / 2);

    if (rawOffset > half) {
      return rawOffset - games.length;
    }

    if (rawOffset < -half) {
      return rawOffset + games.length;
    }

    return rawOffset;
  }

  return (
    <main
      className="arcade-home"
      onMouseMove={handlePointerMove}
      onMouseLeave={() => setPointer({ x: 0, y: 0 })}
      style={{ "--parallax-x": `${pointer.x}px`, "--parallax-y": `${pointer.y}px` } as CSSProperties}
    >
      <PageMeta title="Arcade | Wingtip Studio" description="Play original games and interactive experiments from Wingtip Studio." />
      <div className="atmosphere" aria-hidden="true">
        <div className="atmosphere__fog" />
        <div className="atmosphere__streaks" />
        <div className="atmosphere__particles">
          {particles.map((particle) => (
            <span key={particle.id} style={particle.style} />
          ))}
        </div>
      </div>

      <section className="arcade-hero" aria-labelledby="arcade-title">
        <div className="arcade-visual" aria-hidden="true">
          <div className="arcade-cabinet arcade-cabinet--left">
            <span />
          </div>
          <div className="arcade-marquee">
            <div className="wingtip-logo">
              <img src="/assets/wingtip-logo-transparent.png" alt="Wingtip" />
              <span className="wingtip-logo__shine" aria-hidden="true" />
            </div>
          </div>
          <div className="arcade-cabinet arcade-cabinet--right">
            <span />
          </div>
        </div>
        <div className="arcade-heading">
          <h1 id="arcade-title" aria-label="Wingtip Arcade">
            <span>Wingtip</span>
            <span>Arcade</span>
          </h1>
          <span className="arcade-presented">Produced by Jared Menard</span>
        </div>
      </section>

      <section className="game-carousel" aria-label="Games">
        <div className="game-carousel__stage">
          <button
            className="carousel-control carousel-control--prev"
            type="button"
            onClick={focusPreviousGame}
            aria-label="Previous game"
          >
            {"\u2039"}
          </button>
          <div className={`game-carousel__track${carouselIsMoving ? " is-switching" : ""}`} aria-live="polite">
            {games.map((game, index) => {
              const offset = getCarouselOffset(index);
              const distance = Math.abs(offset);

              return (
                <button
                  className={`carousel-game game-card--${game.accent} carousel-game--distance-${distance}`}
                  type="button"
                  key={game.path}
                  onClick={() => (index === selectedGameIndex ? launchGame(game.path) : selectGame(index))}
                  aria-current={index === selectedGameIndex ? "true" : undefined}
                  aria-label={index === selectedGameIndex ? `Play ${game.name}` : `Focus ${game.name}`}
                  style={
                    {
                      "--carousel-offset": offset,
                      "--carousel-distance": distance,
                    } as CSSProperties
                  }
                >
                  <span className={`game-card__preview game-card__preview--${game.accent}`} aria-hidden="true">
                    <span className="game-card__screen" />
                    <span className="game-card__token" />
                    <span className="carousel-game__scanline" />
                  </span>
                  <span className="carousel-game__title">{game.name}</span>
                </button>
              );
            })}
          </div>
          <button
            className="carousel-control carousel-control--next"
            type="button"
            onClick={focusNextGame}
            aria-label="Next game"
          >
            {"\u203a"}
          </button>
        </div>

        <article className={`game-feature game-card--${selectedGame.accent}`} key={selectedGame.path}>
          <div className="game-feature__copy">
            <span className="game-card__tag">{selectedGame.category}</span>
            <span className="platform-badge">{platformDetails[selectedGame.platform].title}</span>
            <h2>{selectedGame.name}</h2>
            <p>{selectedGame.description}</p>
          </div>
          <button className="play-button" type="button" onClick={() => launchGame(selectedGame.path)}>
            {selectedGame.cta}
          </button>
        </article>
      </section>

      <section className="platform-groups" aria-labelledby="browse-games">
        <div className="section-heading"><p className="eyebrow">Choose your screen</p><h2 id="browse-games">Browse all games</h2></div>
        {(["mobile-first", "desktop-optimized"] as PlatformCategory[]).map((platform) => {
          const group = games.filter((game) => game.platform === platform).sort((a, b) => a.sortOrder - b.sortOrder);
          const details = platformDetails[platform];
          return (
            <section className={`platform-group platform-group--${platform}`} key={platform}>
              <header><h3>{details.title}</h3><p>{details.description}</p></header>
              {group.length === 0 ? <p className="empty-state">No games are assigned to this category yet.</p> : (
                <div className="platform-game-grid">{group.map((game) => (
                  <article className={`platform-game game-card--${game.accent}`} key={game.id}>
                    <span className="platform-badge">{details.title}</span><h4>{game.name}</h4><p>{game.description}</p><small>{game.controlsNote}</small>
                    <button type="button" onClick={() => launchGame(game.path)}>{game.cta}</button>
                  </article>
                ))}</div>
              )}
            </section>
          );
        })}
      </section>
      <footer className="arcade-footer">
        <span>Wingtip Arcade v0.4.0</span>
        <a href="mailto:wingtip.studio@gmail.com">Reach the developer at: wingtip.studio@gmail.com</a>
      </footer>
    </main>
  );
}

function random(index: number, salt: number): number {
  const value = Math.sin(index * 133.7 + salt * 271.9) * 43758.5453;

  return value - Math.floor(value);
}

function loopIndex(index: number) {
  return (index + games.length) % games.length;
}
