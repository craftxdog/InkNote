type ClosableDocumentStore = Readonly<{
  close(): void;
}>;

type DocumentStoreStartupOptions<TStore extends ClosableDocumentStore> =
  Readonly<{
    ensureMigrationSafety: () => Promise<unknown>;
    createStore: () => TStore;
  }>;

/**
 * Orders startup-sensitive store creation. The preflight always settles before
 * a store can run synchronous SQLite migrations or an IPC handler can receive
 * the store. Closing it after a restore makes the next initialize call reopen
 * the replacement database through the same safety gate.
 */
export class DocumentStoreStartup<TStore extends ClosableDocumentStore> {
  private store: TStore | null = null;

  private initialization: Promise<TStore> | null = null;

  constructor(private readonly options: DocumentStoreStartupOptions<TStore>) {}

  async initialize(): Promise<TStore> {
    if (this.store !== null) {
      return this.store;
    }

    if (this.initialization !== null) {
      return this.initialization;
    }

    this.initialization = this.initializeStore();

    try {
      return await this.initialization;
    } finally {
      this.initialization = null;
    }
  }

  getInitialized(): TStore {
    if (this.store === null) {
      throw new Error('The local document store is not initialized.');
    }

    return this.store;
  }

  close(): void {
    this.store?.close();
    this.store = null;
  }

  private async initializeStore(): Promise<TStore> {
    await this.options.ensureMigrationSafety();
    const store = this.options.createStore();

    this.store = store;

    return store;
  }
}
