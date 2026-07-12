import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type GameFrameProps = {
  title: string;
  src: string;
};

export default function GameFrame({ title, src }: GameFrameProps) {
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [waitState, setWaitState] = useState<"loading" | "long" | "error">("loading");
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    document.body.classList.remove("is-launching-game");
    setLoaded(false);
    setWaitState("loading");
  }, [src]);

  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => {
      setWaitState((state) => state === "loading" ? "long" : state);
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [loaded, frameKey]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) {
        return;
      }

      if (event.data?.type === "wingtip:back-to-arcade") navigate("/");
      if (event.data?.type === "wingtip:game-ready") setLoaded(true);
      if (event.data?.type === "wingtip:game-error") setWaitState("error");
    }

    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  return (
    <main className="game-route" aria-label={title}>
      <Link className="arcade-back" to="/" aria-label="Back to Arcade">
        {"\u2190"} Arcade
      </Link>
      {!loaded && (
        <div className="game-loading" aria-live="polite">
          <div className="game-loading__mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <p>{title}</p>
            <span>
              {waitState === "loading" && "Loading..."}
              {waitState === "long" && "Still loading - some games can take a minute"}
              {waitState === "error" && "The game could not finish loading"}
            </span>
            {waitState !== "loading" && (
              <button className="game-loading__retry" type="button" onClick={() => {
                setLoaded(false);
                setWaitState("loading");
                setFrameKey((key) => key + 1);
              }}>
                Reload game
              </button>
            )}
          </div>
        </div>
      )}
      <iframe ref={frameRef} className="game-frame" key={`${src}:${frameKey}`} src={src} title={title} onError={() => setWaitState("error")} />
    </main>
  );
}
