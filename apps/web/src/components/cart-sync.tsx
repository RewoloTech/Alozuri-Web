'use client';
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { cartItems, type CartLine } from '@voyaspan/shared';
import { restoreCart, setCartVersion, cartError, cartSyncing, type RootState } from '@/lib/store';
import { api, demoMode } from '@/lib/api';
import { useAuth } from './auth-provider';
export function CartSync() {
  const dispatch = useDispatch(),
    { user, loading } = useAuth();
  const cart = useSelector((s: RootState) => s.cart);
  const readyUid = useRef<string | null>(null),
    lastSaved = useRef('');
  const version = useRef(0),
    currentUid = useRef<string | null>(null);
  useEffect(() => {
    currentUid.current = user?.uid ?? null;
  }, [user]);
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
    if (!user) {
      if (readyUid.current) {
        dispatch(restoreCart([]));
        try {
          localStorage.removeItem('alozuri-cart-merge');
          localStorage.removeItem('alozuri-cart-owner');
        } catch {}
      }
      readyUid.current = null;
      lastSaved.current = '';
      return;
    }
    if (!user.emailVerified || demoMode || readyUid.current === user.uid) return;
    const uid = user.uid;
    readyUid.current = uid;
    dispatch(cartSyncing(true));
    lastSaved.current = '';
    const previousOwner = localStorage.getItem('alozuri-cart-owner');
    const changingAccount = Boolean(previousOwner && previousOwner !== uid);
    if (changingAccount) {
      dispatch(restoreCart([]));
      localStorage.removeItem('alozuri-cart-merge');
    }
    const mergeId = localStorage.getItem('alozuri-cart-merge') || crypto.randomUUID();
    localStorage.setItem('alozuri-cart-merge', mergeId);
    const synchronize = async () => {
      const pendingKey = 'alozuri-cart-pending-' + uid;
      const pending = JSON.parse(localStorage.getItem(pendingKey) || 'null') as {
        items: { planId: string; quantity: number }[];
        version: number;
      } | null;
      if (pending) {
        const server = await api<{ items: CartLine[]; version: number }>('/v2/cart', {}, true);
        if (JSON.stringify(cartItems(server.items)) === JSON.stringify(pending.items))
          localStorage.removeItem(pendingKey);
        else if (server.version === pending.version) {
          await api('/v2/cart', { method: 'PUT', body: JSON.stringify(pending) }, true);
          localStorage.removeItem(pendingKey);
        } else
          throw new Error(
            'Your cart changed on another device. Your local cart is preserved; use the saved account cart to resolve the conflict.',
          );
      }
      return api<{ items: CartLine[]; version: number }>(
        '/v2/cart/merge',
        {
          method: 'POST',
          body: JSON.stringify({
            items: changingAccount || previousOwner === uid ? [] : cartItems(cart.items),
            mergeId,
          }),
        },
        true,
      );
    };
    void synchronize()
      .then((r) => {
        if (currentUid.current !== uid) return;
        version.current = r.version;
        lastSaved.current = JSON.stringify(cartItems(r.items));
        dispatch(setCartVersion(r.version));
        dispatch(restoreCart(r.items));
        localStorage.setItem('alozuri-cart-owner', uid);
        dispatch(cartSyncing(false));
        // This merge ID remains durable until sign-out; retries never add the same guest cart twice.
      })
      .catch((e) => {
        if (currentUid.current === uid) {
          readyUid.current = null;
          dispatch(cartSyncing(false));
          dispatch(cartError(e instanceof Error ? e.message : 'Cart sync unavailable.'));
        }
      });
    // Merge once per identity, preserving the existing authenticated cart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, cart.ready, dispatch]);
  useEffect(() => {
    if (!cart.ready || !user?.emailVerified || readyUid.current !== user.uid || demoMode) return;
    const signature = JSON.stringify(cartItems(cart.items));
    if (signature === lastSaved.current) return;
    const uid = user.uid;
    if (lastSaved.current) {
      try {
        localStorage.setItem(
          'alozuri-cart-pending-' + uid,
          JSON.stringify({ items: cartItems(cart.items), version: version.current }),
        );
      } catch {}
    }
    const timer = setTimeout(() => {
      if (!lastSaved.current) return;
      dispatch(cartSyncing(true));
      void api<{ items: CartLine[]; version: number }>(
        '/v2/cart',
        {
          method: 'PUT',
          body: JSON.stringify({ items: cartItems(cart.items), version: version.current }),
        },
        true,
      )
        .then((r) => {
          if (currentUid.current !== uid) return;
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
          dispatch(cartSyncing(false));
        })
        .catch((e) => {
          if (currentUid.current !== uid) return;
          dispatch(cartSyncing(false));
          dispatch(cartError(e instanceof Error ? e.message : 'Cart sync unavailable.'));
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [cart.items, cart.ready, user, dispatch]);
  return null;
}
