import bidiFactory from 'bidi-js';
import LineBreaker from 'linebreak';
import type PDFDocument from 'pdfkit';
const bidi = bidiFactory();
const controls = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
export type PdfTextRun = { text: string; font: 'Latin' | 'Arabic'; rtl: boolean };
/** Unicode bidi reorders runs, not Arabic letters. Fontkit shapes each logical Arabic run once. */
export function pdfVisualRuns(
  text: string,
  direction: 'ltr' | 'rtl',
  levels?: Uint8Array,
): PdfTextRun[] {
  if (!text) return [];
  const embedding = levels
    ? {
        levels,
        paragraphs: [{ start: 0, end: text.length - 1, level: direction === 'rtl' ? 1 : 0 }],
      }
    : bidi.getEmbeddingLevels(text, direction);
  const mirrors = bidi.getMirroredCharactersMap(text, embedding);
  const groups: { start: number; end: number; font: PdfTextRun['font']; level: number }[] = [];
  const groupAt: number[] = [];
  let previousFont: PdfTextRun['font'] = 'Latin';
  for (let index = 0; index < text.length;) {
    const codepoint = text.codePointAt(index);
    if (codepoint === undefined) break;
    const char = String.fromCodePoint(codepoint);
    const font: PdfTextRun['font'] = /\p{Script_Extensions=Arabic}/u.test(char)
      ? 'Arabic'
      : /\p{Mark}/u.test(char)
        ? previousFont
        : 'Latin';
    const level = embedding.levels[index];
    let group = groups.at(-1);
    if (!group || group.level !== level || group.font !== font) {
      group = { start: index, end: index + char.length - 1, font, level };
      groups.push(group);
    } else group.end = index + char.length - 1;
    for (let offset = 0; offset < char.length; offset++)
      groupAt[index + offset] = groups.length - 1;
    previousFont = font;
    index += char.length;
  }
  const indices = Array.from({ length: text.length }, (_, index) => index);
  for (const [start, end] of bidi.getReorderSegments(text, embedding)) {
    const reversed = indices.slice(start, end + 1).reverse();
    for (let offset = 0; offset < reversed.length; offset++)
      indices[start + offset] = reversed[offset];
  }
  const runs: PdfTextRun[] = [];
  let previous = -1;
  for (const index of indices) {
    const groupIndex = groupAt[index];
    if (groupIndex === previous) continue;
    previous = groupIndex;
    const group = groups[groupIndex];
    let value = '';
    for (let position = group.start; position <= group.end; position++)
      value += mirrors.get(position) ?? text[position];
    value = value.replace(controls, '');
    if (!value) continue;
    // Common punctuation has no RTL script for fontkit to detect.
    if (group.level % 2 && group.font === 'Latin') value = [...value].reverse().join('');
    runs.push({ text: value, font: group.font, rtl: Boolean(group.level % 2) });
  }
  return runs;
}
/** Unicode break opportunities, with grapheme-safe splitting for long private references/URLs. */
export function pdfWrappedLines(
  text: string,
  width: number,
  measure: (text: string) => number,
): string[] {
  if (!Number.isFinite(width) || width <= 0) throw new Error('Invalid PDF text width.');
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/u)) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    const breaker = new LineBreaker(paragraph);
    let start = 0,
      lastFit = 0,
      opportunity;
    while ((opportunity = breaker.nextBreak())) {
      const end = opportunity.position;
      if (measure(paragraph.slice(start, end).trimEnd()) <= width) {
        lastFit = end;
        continue;
      }
      if (lastFit > start) {
        lines.push(paragraph.slice(start, lastFit).trimEnd());
        start = lastFit;
      }
      // A word can itself exceed the width (for example an unbroken order URL).
      while (measure(paragraph.slice(start, end).trimEnd()) > width) {
        let fit = start;
        for (const segment of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
          paragraph.slice(start, end),
        )) {
          const candidate = start + segment.index + segment.segment.length;
          if (measure(paragraph.slice(start, candidate)) > width) break;
          fit = candidate;
        }
        if (fit === start) throw new Error('A PDF glyph exceeds the text width.');
        lines.push(paragraph.slice(start, fit).trimEnd());
        start = fit;
      }
      lastFit = end;
    }
    if (start < paragraph.length) lines.push(paragraph.slice(start).trimEnd());
  }
  return lines;
}
/** Arabic needs explicit run placement: PDFKit's default word cache reverses word order. */
export function drawArabicPdfText(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  options: {
    width: number;
    size: number;
    bold?: boolean;
    color: string;
    direction?: 'ltr' | 'rtl';
    gap?: number;
  },
): void {
  const direction = options.direction ?? 'rtl';
  const font = (run: PdfTextRun) => run.font + (options.bold ? 'Bold' : '');
  const measure = (value: string) =>
    pdfVisualRuns(value, direction).reduce(
      (sum, run) =>
        sum + doc.font(font(run)).fontSize(options.size).widthOfString(run.text, { features: [] }),
      0,
    );
  const lineHeight = options.size * 1.8;
  const left = doc.page.margins.left;
  for (const paragraph of text.split(/\r?\n/u)) {
    const embedding = bidi.getEmbeddingLevels(paragraph, direction);
    let position = 0;
    for (const line of pdfWrappedLines(paragraph, options.width, measure)) {
      if (doc.y + lineHeight > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const y = doc.y;
      const start = paragraph.indexOf(line, position);
      if (start < 0) throw new Error('PDF line is not part of its paragraph.');
      position = start + line.length;
      const runs = pdfVisualRuns(line, direction, embedding.levels.slice(start, position));
      const measured = runs.map((run) => ({
        ...run,
        width: doc.font(font(run)).fontSize(options.size).widthOfString(run.text, { features: [] }),
      }));
      let x =
        left +
        (direction === 'rtl'
          ? options.width - measured.reduce((sum, run) => sum + run.width, 0)
          : 0);
      for (const run of measured) {
        doc
          .font(font(run))
          .fontSize(options.size)
          .fillColor(options.color)
          .text(run.text, x, y + options.size * 1.35, {
            lineBreak: false,
            features: [],
            baseline: 'alphabetic',
          });
        x += run.width;
      }
      doc.x = left;
      doc.y = y + lineHeight;
    }
  }
  doc.y += options.gap ?? 7;
}
