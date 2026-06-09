export interface SingleFileSessionInput {
  path: string;
  name: string;
  body: string;
}

export interface SingleFileSession {
  readonly path: string;
  getValue(): string;
  isDirty(): boolean;
  markSaved(): Promise<void>;
  onDirtyChange(listener: (dirty: boolean) => void): () => void;
  dispose(): void;
}
