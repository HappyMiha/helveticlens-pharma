export type ReadState<T> = Readonly<{
  data: T | null;
  error: string;
  loading: boolean;
  refreshing: boolean;
}>;

/** One mounted reader owns its requests, including transports that ignore abort. */
export class ResourceReader<T> {
  private active = false;
  private generation = 0;
  private controller: AbortController | null = null;
  private listeners = new Set<() => void>();
  private state: ReadState<T>;
  private dataReadStartedAt: number | null = null;
  readStartedAt = () => this.dataReadStartedAt;
  readonly initial: ReadState<T>;

  constructor(
    private readonly url: string | null,
    private readonly load: (url: string, signal: AbortSignal) => Promise<T>,
  ) {
    this.initial = { data: null, error: '', loading: !!url, refreshing: false };
    this.state = this.initial;
  }

  snapshot = () => this.state;
  serverSnapshot = () => this.initial;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: ReadState<T>) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  activate() {
    this.active = true;
  }
  deactivate() {
    this.active = false;
    this.dataReadStartedAt = null;
    this.generation++;
    this.controller?.abort();
    this.controller = null;
  }

  /** Drop the previous session's contents before checking current authority. */
  reset = () => {
    this.dataReadStartedAt = null;
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    this.publish(this.initial);
    return this.refresh();
  };

  /** Background polls wait for the current read; explicit refresh still supersedes it. */
  poll = async () => {
    if (this.controller) return;
    return this.refresh();
  };

  refresh = async () => {
    if (!this.active || !this.url) return;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    const current = () =>
      this.active &&
      generation === this.generation &&
      !controller.signal.aborted;
    this.publish({
      ...this.state,
      loading: !this.state.data && !this.state.error,
      refreshing: true,
    });
    const readStartedAt = performance.now();
    try {
      const data = await this.load(this.url, controller.signal);
      if (current()) {
        this.dataReadStartedAt = readStartedAt;
        this.publish({ data, error: '', loading: false, refreshing: false });
      }
    } catch (cause) {
      if (current()) {
        this.dataReadStartedAt = null;
        this.publish({
          data: null,
          error:
            cause instanceof Error && cause.message
              ? cause.message
              : 'The request could not be completed. Please retry.',
          loading: false,
          refreshing: false,
        });
      }
    } finally {
      if (current()) this.controller = null;
    }
  };
}
