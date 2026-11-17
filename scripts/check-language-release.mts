import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  LOCALES,
  REQUIRED_DOMAINS,
  localeReview,
  isPublishedLocale,
} from '../packages/shared/src/i18n/locales.ts';
import { loadMessages } from '../packages/shared/src/i18n/catalogs.ts';
import { validateMessages } from '../packages/shared/src/i18n/validation.ts';
import { legalDocuments } from '../packages/shared/src/i18n/legal-documents.ts';
import { POLICY_TRANSLATION_REVIEW } from '../packages/shared/src/i18n/policies/catalogs.ts';

export type UntranslatedLiteral = { file: string; line: number; text: string };
const customerAttributes = new Set(['aria-label', 'placeholder', 'alt', 'title']);
const technicalLiterals = new Set([
  'Alozuri',
  'eSIM',
  'ICCID',
  'SM-DP+',
  'APN',
  'Wi-Fi',
  'USD',
  'GBP',
  'EUR',
  'GB',
  'MB',
  'KB',
  'Stripe',
  'Google Pay',
  'Apple Pay',
  'Firebase',
]);

/** Conservative inventory, not a claim that all dynamic strings were found. */
export function untranslatedLiterals(source: string, file: string): UntranslatedLiteral[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const results: UntranslatedLiteral[] = [];
  const add = (node: ts.Node, value: string) => {
    const text = value.replace(/\s+/g, ' ').trim();
    if (!/\p{L}{2}/u.test(text) || technicalLiterals.has(text)) return;
    results.push({
      file,
      line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      text,
    });
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node, node.text);
    if (
      ts.isJsxAttribute(node) &&
      customerAttributes.has(node.name.getText(ast)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    )
      add(node, node.initializer.text);
    // Handles JSX expressions such as {'Continue to payment'}.
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression))
      add(node, node.expression.text);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return results;
}

const internalComponents = new Set([
  'admin.tsx',
  'localization-preview.tsx',
  'pricing-history.tsx',
  'promotions.tsx',
  'supplier-credit.tsx',
]);
async function scan(root: string, directory: string): Promise<UntranslatedLiteral[]> {
  const result: UntranslatedLiteral[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      entry.name === 'operations' ||
      entry.name === 'admin' ||
      entry.name.startsWith('operations-')
    )
      continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await scan(root, file)));
    else if (entry.name.endsWith('.tsx') && !internalComponents.has(entry.name))
      result.push(...untranslatedLiterals(await readFile(file, 'utf8'), path.relative(root, file)));
  }
  return result;
}

export async function languageReleaseReport(root: string) {
  const locales = await Promise.all(
    LOCALES.map(async (locale) => {
      const issues: string[] = [];
      try {
        validateMessages(await loadMessages(locale), locale);
      } catch {
        issues.push('catalogue_validation_failed');
      }
      for (const domain of REQUIRED_DOMAINS)
        if (localeReview(locale)[domain] !== 'published')
          issues.push(`${domain}_${localeReview(locale)[domain]}`);
      try {
        legalDocuments(locale);
      } catch {
        issues.push('legal_documents_unavailable');
      }
      return { locale, ready: isPublishedLocale(locale) && issues.length === 0, issues };
    }),
  );
  const untranslated = await scan(root, path.join(root, 'apps/web/src'));
  return {
    // Content availability and a shipping decision are distinct. This audit
    // never claims human legal review from passing static checks.
    ready:
      locales.every((locale) => locale.ready) &&
      untranslated.length === 0 &&
      POLICY_TRANSLATION_REVIEW.professionalReviewCompleted,
    contentComplete: locales.every((locale) => locale.ready) && untranslated.length === 0,
    professionalLegalReview: POLICY_TRANSLATION_REVIEW,
    blockers: POLICY_TRANSLATION_REVIEW.professionalReviewCompleted
      ? []
      : ['professional_legal_review_required'],
    locales,
    customerLiteralsRequiringExtraction: untranslated.length,
    untranslated,
    limitations:
      'Static JSX inventory is conservative; dynamic strings, complete emails, PDFs and native/legal review require separate verification.',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const report = await languageReleaseReport(root);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.ready) process.exitCode = 1;
}
