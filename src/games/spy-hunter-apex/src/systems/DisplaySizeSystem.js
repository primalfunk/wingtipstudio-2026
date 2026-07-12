export default class DisplaySizeSystem {
  constructor(game) {
    this.game = game;
    this.rafId = null;
    this.resizeObserver = null;
    this.handleResize = () => this.scheduleRefresh();
  }

  start() {
    this.applyViewportSize();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);
    window.visualViewport?.addEventListener('scroll', this.handleResize);

    const parent = document.getElementById('game');
    if (parent && 'ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(parent);
    }

    this.scheduleRefresh();
  }

  scheduleRefresh() {
    if (this.rafId != null) {
      return;
    }

    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null;
      this.applyViewportSize();
      this.game.scale.refresh();
    });
  }

  applyViewportSize() {
    const viewport = window.visualViewport;
    const width = Math.floor(viewport?.width ?? window.innerWidth);
    const height = Math.floor(viewport?.height ?? window.innerHeight);
    document.documentElement.style.setProperty('--app-width', `${width}px`);
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    window.visualViewport?.removeEventListener('scroll', this.handleResize);
    this.resizeObserver?.disconnect();
    if (this.rafId != null) {
      window.cancelAnimationFrame(this.rafId);
    }
  }
}
