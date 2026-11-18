'use client';
import { PromotionPrice } from './promotion-price';
import { usePlanCopy } from '@/lib/use-plan-copy';
import { LinkedMessage, MESSAGE_LINKS } from './linked-message';
import { StoreApiError } from '@/lib/api-error';
import { ERROR_MESSAGES, type ErrorCode } from '@alozuri/shared/i18n/errors';
import type { Messages } from '@alozuri/shared/i18n/messages';
import { trackMeta } from '@/lib/meta-pixel';
import { metaMoney } from '@/lib/meta-events';
import { useMarketingConsent } from './privacy-provider';
import { productStructuredData } from '@/lib/product-seo';
import { jsonLd } from '@/lib/seo';
import { useEffect, useRef, useState } from 'react';
import Link from '@/components/localized-link';
import { useLocale, useTranslations } from 'next-intl';
import { destinationName } from '@alozuri/shared/i18n/destinations';
import { useDispatch, useSelector } from 'react-redux';
import { type Plan } from '@alozuri/shared';
import { demoPlans } from '@alozuri/shared/demo';
import { useCurrency } from './currency-provider';
import { api, demoMode } from '@/lib/api';
import { addToCart, type RootState } from '@/lib/store';
type PlanFailure = { key: keyof Messages['planInfo'] } | { code: ErrorCode };
export function PlanDetails({
  id,
  initialPlan = null,
}: {
  id: string;
  review?: boolean;
  initialPlan?: Plan | null;
}) {
  const locale = useLocale();
  const translate = useTranslations();
  const t = useTranslations('plans');
  const info = useTranslations('planInfo');
  const search = useTranslations('search');
  const cartCopy = useTranslations('cart');
  const errors = useTranslations('errors');
  const legal = useTranslations('legal');
  const payment = useTranslations('paymentUi');
  const copy = usePlanCopy();
  const marketing = useMarketingConsent();
  const viewId = useRef<string | null>(null);
  const { currency, refresh, ready } = useCurrency();
  const dispatch = useDispatch(),
    cart = useSelector((s: RootState) => s.cart);
  const [plan, setPlan] = useState<Plan | null>(
      () => initialPlan ?? (demoMode ? (demoPlans.find((p) => p.id === id) ?? null) : null),
    ),
    [loading, setLoading] = useState(!demoMode && !initialPlan),
    [adding, setAdding] = useState(false),
    [added, setAdded] = useState(false),
    [error, setError] = useState<PlanFailure | null>(null),
    [retry, setRetry] = useState(0);
  const loadedRequest = useRef(initialPlan ? `${id}:USD:0:0` : '');
  useEffect(() => {
    if (demoMode || !ready) return;
    const key = `${id}:${currency}:${refresh}:${retry}`;
    if (loadedRequest.current === key) {
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void api<{ plan: Plan }>(
      '/v1/packages/' +
        encodeURIComponent(id) +
        (currency === 'USD' ? '' : '?currency=' + currency),
      { signal: controller.signal },
    )
      .then((r) => {
        if (active) {
          setPlan(r.plan);
          loadedRequest.current = key;
        }
      })
      .catch(() => {
        if (active) setError({ key: 'priceError' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, currency, refresh, ready, retry]);
  useEffect(() => {
    if (
      !marketing ||
      !ready ||
      loading ||
      error ||
      !plan ||
      plan.id !== id ||
      plan.demo ||
      plan.currency !== currency
    )
      return;
    const data = metaMoney(plan.priceCents, plan.currency);
    if (!data) return;
    viewId.current ??= crypto.randomUUID();
    void trackMeta(
      'ViewContent',
      { ...data, content_ids: [plan.id], content_type: 'product' },
      viewId.current,
    );
  }, [marketing, ready, loading, error, plan, id, currency]);
  async function add() {
    if (!ready || !plan || plan.demo || plan.currency !== currency || loading || error) return;
    setAdding(true);
    setAdded(false);
    setError(null);
    try {
      const fresh = await api<{ plan: Plan }>(
        '/v1/packages/' +
          encodeURIComponent(id) +
          (currency === 'USD' ? '' : '?currency=' + currency),
      );
      if (fresh.plan.demo) throw new Error('Sample plans cannot be purchased.');
      setPlan(fresh.plan);
      dispatch(addToCart(fresh.plan));
      setAdded(true);
    } catch (e) {
      setError(e instanceof StoreApiError ? { code: e.code } : { key: 'addError' });
    } finally {
      setAdding(false);
    }
  }
  if (loading && !plan)
    return (
      <div className="loading-page" role="status">
        {payment('loadingPlan')}
      </div>
    );
  if (!plan)
    return (
      <section className="container section">
        <h1>{info('unavailable')}</h1>
        <p role="alert">
          {error ? ('code' in error ? errors(ERROR_MESSAGES[error.code]) : info(error.key)) : ''}
        </p>
        <Link className="button" href="/destinations">
          {info('search')}
        </Link>
      </section>
    );
  const limit =
    cart.items.reduce((n, i) => n + i.quantity, 0) >= 10 ||
    (cart.items.find((i) => i.plan.id === id)?.quantity ?? 0) >= 5;
  return (
    <section className="container section">
      {!plan.demo && !error && !loading && (!ready || plan.currency === currency) && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(productStructuredData(plan, copy.locale, translate)),
          }}
        />
      )}
      <Link className="text-link" href="/destinations">
        {cartCopy('explore')}
      </Link>
      <div className="page-intro">
        <span className="eyebrow">{info('eyebrow')}</span>
        <h1>{copy.title(plan)}</h1>
        <p>
          {copy.allowance(plan)} · {t('days', { count: plan.days })} · {search('dataOnly')}
        </p>
      </div>
      <div className="detail-layout" dir="ltr">
        <div className="stack" dir={copy.dir}>
          <div className="surface">
            <h2>{info(plan.countries.length === 1 ? 'localCoverage' : 'multiCoverage')}</h2>
            <p>{info('includes', { count: plan.countries.length })}</p>
            <div className="coverage-list" dir="ltr">
              {plan.countries.map((c) => (
                <span key={c} dir={copy.dir}>
                  {destinationName(c, locale)}
                </span>
              ))}
            </div>
          </div>
          <div className="surface">
            <h2>{info('know')}</h2>
            <dl className="spec-list">
              <div>
                <dt>{info('activation')}</dt>
                <dd>{copy.activation(plan.activation)}</dd>
              </div>
              <div>
                <dt>{info('networks')}</dt>
                <dd>{plan.networks.length ? plan.networks.join(', ') : info('networkMissing')}</dd>
              </div>
              <div>
                <dt>{info('dataPolicy')}</dt>
                <dd>{copy.fairUse(plan.fairUse)}</dd>
              </div>
              <div>
                <dt>{info('calls')}</dt>
                <dd>{info('callsText')}</dd>
              </div>
            </dl>
            <Link href="/help#compatibility" className="text-link">
              {info('device')}
            </Link>
            {plan.supplierNotes && (
              <details className="plan-conditions">
                <summary>{info('conditions')}</summary>
                <p style={{ whiteSpace: 'pre-line' }}>{copy.notes(plan.supplierNotes)}</p>
                <p>
                  <LinkedMessage
                    message={info('rights', { refunds: MESSAGE_LINKS.refunds })}
                    links={{ refunds: { href: '/refund-policy', label: legal('refunds') } }}
                  />
                </p>
              </details>
            )}
          </div>
        </div>
        <aside className="surface purchase-summary" dir={copy.dir}>
          <span className="eyebrow">{plan.demo ? info('sample') : info('summary')}</span>
          <h2 dir="ltr">
            {(!ready || plan.currency === currency) && !loading && !error ? (
              <PromotionPrice
                amount={plan.priceCents}
                currency={plan.currency}
                promotion={plan.promotionPrice}
              />
            ) : error ? (
              t('unavailable')
            ) : (
              t('loadingPrice')
            )}{' '}
            <small>{ready ? currency : plan.currency}</small>
          </h2>
          <p>
            {copy.allowance(plan)} · {t('days', { count: plan.days })}
          </p>
          <p>{search('coverage', { count: plan.countries.length })}</p>
          {plan.demo && <p className="notice">{info('sampleNotice')}</p>}
          <button
            className="button primary full-width"
            disabled={
              !ready ||
              plan.currency !== currency ||
              Boolean(plan.demo) ||
              loading ||
              Boolean(error) ||
              adding ||
              limit ||
              !cart.ready ||
              cart.syncing
            }
            onClick={() => void add()}
          >
            {adding
              ? info('adding')
              : !ready || plan.currency !== currency || loading
                ? t('loadingPrice')
                : !cart.ready || cart.syncing
                  ? info('basket')
                  : t('add')}
          </button>
          <Link
            className="button full-width"
            href={plan.demo ? '#' : '/checkout?buy=' + encodeURIComponent(id)}
            aria-disabled={Boolean(plan.demo)}
            onClick={(event) => {
              if (plan.demo) event.preventDefault();
            }}
          >
            {t('buy')}
          </Link>
          {error && (
            <button
              type="button"
              className="button full-width"
              onClick={() => setRetry((value) => value + 1)}
            >
              {info('retry')}
            </button>
          )}
          {added && (
            <div role="status" className="success-message">
              <p>{info('added')}</p>
              <Link href="/destinations">{cartCopy('continueShopping')}</Link> ·{' '}
              <Link href="/cart">{info('viewCart')}</Link>
            </div>
          )}
          {(error || limit || cart.error) && (
            <p className="error-message" role="alert">
              {error
                ? 'code' in error
                  ? errors(ERROR_MESSAGES[error.code])
                  : info(error.key)
                : limit
                  ? info('limit')
                  : cartCopy('syncError')}
            </p>
          )}
          <p className="fine-print">{info('deviceNotice')}</p>
          <Link href="/refund-policy" className="text-link">
            {info('refunds')}
          </Link>
        </aside>
      </div>
    </section>
  );
}
