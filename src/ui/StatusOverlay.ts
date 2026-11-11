import type { GameStats } from '../core/Game';

/**
 * Minimal DOM shell used during Phase 0.
 *
 * This is not the game HUD. It only reports boot state, fatal startup errors
 * and (in debug mode) live engine statistics. The full HUD arrives with the
 * gameplay phases and must read real simulation state.
 */

const SELECTORS = {
  boot: '[data-ui="boot"]',
  bootStatus: '[data-ui="boot-status"]',
  fatal: '[data-ui="fatal"]',
  fatalMessage: '[data-ui="fatal-message"]',
  stats: '[data-ui="debug-stats"]',
} as const;

interface OverlayElements {
  readonly boot: HTMLElement;
  readonly bootStatus: HTMLElement;
  readonly fatal: HTMLElement;
  readonly fatalMessage: HTMLElement;
  readonly stats: HTMLElement;
}

export class StatusOverlay {
  private readonly elements: OverlayElements;

  private constructor(elements: OverlayElements) {
    this.elements = elements;
  }

  /** Bind to the elements declared in `index.html`. */
  static fromDocument(root: ParentNode = document): StatusOverlay {
    const query = <T extends Element>(selector: string): T => {
      const element = root.querySelector<T>(selector);
      if (element === null) {
        throw new Error(`StatusOverlay: required UI element "${selector}" was not found.`);
      }
      return element;
    };

    return new StatusOverlay({
      boot: query<HTMLElement>(SELECTORS.boot),
      bootStatus: query<HTMLElement>(SELECTORS.bootStatus),
      fatal: query<HTMLElement>(SELECTORS.fatal),
      fatalMessage: query<HTMLElement>(SELECTORS.fatalMessage),
      stats: query<HTMLElement>(SELECTORS.stats),
    });
  }

  setBootStatus(message: string): void {
    this.elements.bootStatus.textContent = message;
  }

  hideBoot(): void {
    this.elements.boot.classList.add('is-hidden');
    this.elements.boot.setAttribute('aria-hidden', 'true');
  }

  showFatal(message: string): void {
    this.elements.fatalMessage.textContent = message;
    this.elements.fatal.hidden = false;
    this.hideBoot();
  }

  showStats(): void {
    this.elements.stats.classList.remove('is-hidden');
    this.elements.stats.setAttribute('aria-hidden', 'false');
  }

  hideStats(): void {
    this.elements.stats.classList.add('is-hidden');
    this.elements.stats.setAttribute('aria-hidden', 'true');
  }

  updateStats(stats: GameStats): void {
    this.elements.stats.textContent = formatStats(stats);
  }
}

/** Format engine statistics as compact, fixed-width debug text. */
export function formatStats(stats: GameStats): string {
  const fps = stats.fps.toFixed(1).padStart(5, ' ');
  const frameTime = stats.frameTimeMs.toFixed(1);
  const simSeconds = (stats.simulationTimeMs / 1000).toFixed(2);
  const triangles = stats.triangles.toLocaleString('en-US');

  return [
    `FPS ${fps}   frame ${frameTime} ms   sim ${simSeconds} s   ticks ${stats.tickCount}`,
    `draws ${stats.drawCalls}   tris ${triangles}   systems ${stats.systems}   status ${stats.status}`,
  ].join('\n');
}
