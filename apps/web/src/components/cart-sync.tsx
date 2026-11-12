'use client';
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { cartItems, type CartLine } from '@alozuri/shared';
import {
  restoreCart,
  setCartVersion,
  cartError,
  cartSyncing,
  cartSyncFailure,
  type RootState,
} from '@/lib/store';
import { preserveCartEdits, readMergeIntent } from '@/lib/cart-sync-state';
import { api, demoMode } from '@/lib/api';
import { useAuth } from './auth-provider';
export function CartSync() {
  const dispatch = useDispatch(),
    { user, loading } = useAuth();
  const cart = useSelector((s: RootState) => s.cart),
    store = useStore<RootState>();
  const uid = user?.uid ?? null,
    verified = user?.emailVerified ?? false;
  const readyUid = useRef<string | null>(null),
    lastSaved = useRef('');
  const version = useRef(0),
    currentUid = useRef<string | null>(null),
    currentVerified = useRef(false),
    generation = useRef(0),
    mounted = useRef(true),
    startedUid = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (currentUid.current !== uid || currentVerified.current !== verified) generation.current++;
    currentUid.current = uid;
    currentVerified.current = verified;
  }, [uid, verified]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('alozuri-cart') || '[]') as CartLine[];
      const valid = Array.isArray(saved)
        ? saved
            .filter(
              (i) =>
                i?.plan &&
                typeof i.plan.id === 'string' &&
                typeof i.plan.name === 'string' &&
                Array.isArray(i.plan.countries) &&
                i.plan.countries.every((c) => typeof c === 'string') &&
                typeof i.plan.priceCents === 'number' &&
                Number.isFinite(i.plan.priceCents) &&
                ['USD', 'GBP', 'EUR'].includes(i.plan.currency) &&
                typeof i.plan.dataGb === 'number' &&
                typeof i.plan.days === 'number' &&
                Number.isInteger(i.quantity) &&
                i.quantity > 0 &&
                i.quantity <= 5,
            )
            .slice(0, 10)
        : [];
      dispatch(restoreCart(valid));
    } catch {
      dispatch(restoreCart([]));
    }
  }, [dispatch]);
  useEffect(() => {
    if (cart.ready) {
      try {
        localStorage.setItem('alozuri-cart', JSON.stringify(cart.items));
      } catch {
        dispatch(
          cartError('Your browser could not save the cart. Keep this page open until checkout.'),
        );
      }
    }
  }, [cart.ready, cart.items, dispatch]);
  useEffect(() => {
    if (!cart.ready || loading) return;
    if (!uid) {
      if (startedUid.current) {
        dispatch(restoreCart([]));
        try {
          localStorage.removeItem('alozuri-cart-merge');
          localStorage.removeItem('alozuri-cart-merge-intent');
          localStorage.removeItem('alozuri-cart-owner');
        } catch {}
        dispatch(cartSyncFailure(''));
      }
      startedUid.current = null;
      readyUid.current = null;
      lastSaved.current = '';
      version.current = 0;
      dispatch(cartSyncing(false));
      return;
    }
    if (!verified) {
      readyUid.current = null;
      lastSaved.current = '';
      dispatch(cartSyncing(false));
      return;
    }
    if (demoMode || readyUid.current === uid || (cart.syncFailed && cart.error)) return;
    const session = generation.current;
    const active = () =>
      mounted.current && generation.current === session && currentUid.current === uid;
    readyUid.current = uid;
    startedUid.current = uid;
    dispatch(cartSyncing(true));
    lastSaved.current = '';
    const synchronize = async () => {
      const previousOwner = localStorage.getItem('alozuri-cart-owner');
      const changingAccount = Boolean(previousOwner && previousOwner !== uid);
      const initial = store.getState().cart.items;
      if (changingAccount) {
        dispatch(restoreCart([]));
        localStorage.removeItem('alozuri-cart-merge');
        localStorage.removeItem('alozuri-cart-merge-intent');
      }
      const existing = readMergeIntent(localStorage.getItem('alozuri-cart-merge-intent'));
      const intent =
        existing?.uid === uid && previousOwner !== uid
          ? existing
          : {
              uid,
              mergeId: localStorage.getItem('alozuri-cart-merge') || crypto.randomUUID(),
              items: changingAccount || previousOwner === uid ? [] : cartItems(initial),
            };
      localStorage.setItem('alozuri-cart-merge', intent.mergeId);
      localStorage.setItem('alozuri-cart-merge-intent', JSON.stringify(intent));
      const baseline = changingAccount
        ? []
        : previousOwner === uid
          ? cartItems(initial)
          : intent.items;
      const pendingKey = 'alozuri-cart-pending-' + uid;
      const pending = JSON.parse(localStorage.getItem(pendingKey) || 'null') as {
        items: { planId: string; quantity: number }[];
        version: number;
      } | null;
      if (pending) {
        const server = await api<{ items: CartLine[]; version: number }>('/v2/cart', {}, uid);
        if (!active()) return;
        if (JSON.stringify(cartItems(server.items)) === JSON.stringify(pending.items))
          localStorage.removeItem(pendingKey);
        else if (server.version === pending.version) {
          await api('/v2/cart', { method: 'PUT', body: JSON.stringify(pending) }, uid);
          if (!active()) return;
          localStorage.removeItem(pendingKey);
        } else
          throw new Error(
            'Your cart changed on another device. Your local cart is preserved; use the saved account cart to resolve the conflict.',
          );
      }
      if (!active()) return;
      const result = await api<{ items: CartLine[]; version: number }>(
        '/v2/cart/merge',
        {
          method: 'POST',
          body: JSON.stringify({ items: intent.items, mergeId: intent.mergeId }),
        },
        uid,
      );
      if (!active()) return;
      const items = preserveCartEdits(result.items, baseline, store.getState().cart.items);
      version.current = result.version;
      lastSaved.current = JSON.stringify(cartItems(result.items));
      // Mark ownership before replacing the cached guest snapshot.
      localStorage.setItem('alozuri-cart-owner', uid);
      dispatch(setCartVersion(result.version));
      dispatch(restoreCart(items));
      dispatch(cartSyncFailure(''));
      dispatch(cartSyncing(false));
    };
    void synchronize().catch((error) => {
      if (!active()) return;
      readyUid.current = null;
      dispatch(cartSyncing(false));
      dispatch(cartSyncFailure(error instanceof Error ? error.message : 'Cart sync unavailable.'));
    });
  }, [uid, verified, loading, cart.ready, cart.error, cart.syncFailed, dispatch, store]);
  useEffect(() => {
    if (
      !cart.ready ||
      !uid ||
      !verified ||
      readyUid.current !== uid ||
      !lastSaved.current ||
      cart.syncing ||
      (cart.syncFailed && cart.error) ||
      demoMode
    )
      return;
    const signature = JSON.stringify(cartItems(cart.items));
    if (signature === lastSaved.current) return;
    const session = generation.current;
    const active = () =>
      mounted.current && generation.current === session && currentUid.current === uid;
    if (lastSaved.current) {
      try {
        localStorage.setItem(
          'alozuri-cart-pending-' + uid,
          JSON.stringify({ items: cartItems(cart.items), version: version.current }),
        );
      } catch {}
    }
    const timer = setTimeout(() => {
      if (!active() || !lastSaved.current) return;
      dispatch(cartSyncing(true));
      void api<{ items: CartLine[]; version: number }>(
        '/v2/cart',
        {
          method: 'PUT',
          body: JSON.stringify({ items: cartItems(cart.items), version: version.current }),
        },
        uid,
      )
        .then((r) => {
          if (!active()) return;
          version.current = r.version;
          lastSaved.current = signature;
          try {
            const pending = JSON.parse(
              localStorage.getItem('alozuri-cart-pending-' + uid) || 'null',
            );
            if (JSON.stringify(pending?.items) === signature)
              localStorage.removeItem('alozuri-cart-pending-' + uid);
          } catch {}
          dispatch(setCartVersion(r.version));
          dispatch(cartSyncFailure(''));
          dispatch(cartSyncing(false));
        })
        .catch((e) => {
          if (!active()) return;
          dispatch(cartSyncing(false));
          dispatch(cartSyncFailure(e instanceof Error ? e.message : 'Cart sync unavailable.'));
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [cart.items, cart.ready, cart.syncing, cart.error, cart.syncFailed, uid, verified, dispatch]);
  return null;
}
