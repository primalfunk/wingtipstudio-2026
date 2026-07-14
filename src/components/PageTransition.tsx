import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";

const transitionDuration = 300;

type PageSnapshot = {
  key: string;
  outlet: ReactNode;
};

export default function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const routeKey = location.key || location.pathname;
  const [currentPage, setCurrentPage] = useState<PageSnapshot>(() => ({ key: routeKey, outlet }));
  const isTransitioning = currentPage.key !== routeKey;

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [routeKey]);

  useEffect(() => {
    if (!isTransitioning) return;

    const timer = window.setTimeout(() => {
      setCurrentPage({ key: routeKey, outlet });
    }, transitionDuration);

    return () => window.clearTimeout(timer);
  }, [isTransitioning, outlet, routeKey]);

  return (
    <div className="page-transition-stage">
      <div
        className={`page-transition-layer${isTransitioning ? " page-transition-layer--outgoing" : ""}`}
        aria-hidden={isTransitioning || undefined}
      >
        {currentPage.outlet}
      </div>
      {isTransitioning && (
        <div className="page-transition-layer page-transition-layer--incoming">
          {outlet}
        </div>
      )}
    </div>
  );
}
