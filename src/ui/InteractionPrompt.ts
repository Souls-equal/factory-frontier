/**
 * Interaction prompt UI.
 *
 * Presentation only: it renders whatever the interaction system currently
 * targets and never performs targeting or input handling itself.
 */

export interface PromptTarget {
  readonly displayName: string;
  readonly hint: string;
}

const SELECTORS = {
  prompt: '[data-ui="interaction-prompt"]',
  name: '[data-ui="interaction-name"]',
  hint: '[data-ui="interaction-hint"]',
  feedback: '[data-ui="interaction-feedback"]',
} as const;

const FEEDBACK_VISIBLE_MS = 2600;

export class InteractionPrompt {
  private readonly elements: {
    readonly prompt: HTMLElement;
    readonly name: HTMLElement;
    readonly hint: HTMLElement;
    readonly feedback: HTMLElement;
  };

  private readonly window: Window | null;
  private visible = false;
  private shownId: string | null = null;
  private feedbackTimer: number | undefined;

  private constructor(
    elements: InteractionPrompt['elements'],
    view: Window | null,
  ) {
    this.elements = elements;
    this.window = view;
    this.hide();
  }

  static fromDocument(root: ParentNode = document): InteractionPrompt {
    const query = (selector: string): HTMLElement => {
      const element = root.querySelector<HTMLElement>(selector);
      if (element === null) {
        throw new Error(`InteractionPrompt: required UI element "${selector}" was not found.`);
      }
      return element;
    };

    const prompt = query(SELECTORS.prompt);
    return new InteractionPrompt(
      {
        prompt,
        name: query(SELECTORS.name),
        hint: query(SELECTORS.hint),
        feedback: query(SELECTORS.feedback),
      },
      prompt.ownerDocument.defaultView,
    );
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /**
   * Show the prompt for a target. Re-rendering is skipped when the same target
   * stays focused, so this is safe to call every frame.
   */
  show(target: PromptTarget, id = target.displayName): void {
    if (this.visible && this.shownId === id) {
      return;
    }

    this.elements.name.textContent = target.displayName;
    this.elements.hint.textContent = target.hint;
    this.elements.prompt.classList.remove('is-hidden');
    this.elements.prompt.setAttribute('aria-hidden', 'false');
    this.visible = true;
    this.shownId = id;
  }

  hide(): void {
    if (!this.visible && this.shownId === null) {
      return;
    }
    this.elements.prompt.classList.add('is-hidden');
    this.elements.prompt.setAttribute('aria-hidden', 'true');
    this.visible = false;
    this.shownId = null;
  }

  /** Transient feedback after an interaction (auto-hides). */
  showFeedback(message: string): void {
    const text = message.trim();
    if (text === '') {
      return;
    }

    this.elements.feedback.textContent = text;
    this.elements.feedback.classList.remove('is-hidden');

    if (this.window === null) {
      return;
    }

    if (this.feedbackTimer !== undefined) {
      this.window.clearTimeout(this.feedbackTimer);
    }
    this.feedbackTimer = this.window.setTimeout(() => {
      this.elements.feedback.classList.add('is-hidden');
      this.feedbackTimer = undefined;
    }, FEEDBACK_VISIBLE_MS);
  }

  get feedbackText(): string {
    return this.elements.feedback.textContent ?? '';
  }

  dispose(): void {
    if (this.feedbackTimer !== undefined && this.window !== null) {
      this.window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = undefined;
    }
  }
}
