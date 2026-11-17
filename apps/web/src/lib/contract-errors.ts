/** Stable, non-personal codes for local PDF presentation failures. */
export class ContractDownloadError extends Error {
  constructor(readonly code: 'FONT_UNAVAILABLE') {
    super(code);
  }
}
