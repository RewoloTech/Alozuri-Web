declare module 'bidi-js' {
  export type EmbeddingLevels = {
    levels: Uint8Array;
    paragraphs: { start: number; end: number; level: number }[];
  };
  export default function bidiFactory(): {
    getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl'): EmbeddingLevels;
    getReorderSegments(
      text: string,
      embedding: EmbeddingLevels,
      start?: number,
      end?: number,
    ): [number, number][];
    getMirroredCharactersMap(
      text: string,
      embedding: EmbeddingLevels,
      start?: number,
      end?: number,
    ): Map<number, string>;
  };
}
declare module 'linebreak' {
  export default class LineBreaker {
    constructor(text: string);
    nextBreak(): { position: number; required: boolean } | null;
  }
}
