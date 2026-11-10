// Contract stub for UI behaviour only. Real Stripe sandbox coverage lives in test:stripe.
export function installStripeStub(window: Window, wallets: boolean) {
  let calls = 0;
  function create(type: string) {
    let node: HTMLElement | null = null;
    const callbacks = new Map<string, (e: unknown) => void>();
    return {
      on: (name: string, cb: (e: unknown) => void) => {
        callbacks.set(name, cb);
        if (name === 'ready')
          setTimeout(
            () =>
              cb(
                type === 'expressCheckout'
                  ? {
                      availablePaymentMethods: wallets ? { applePay: true, googlePay: true } : null,
                    }
                  : {},
              ),
            0,
          );
      },
      off: (name: string) => callbacks.delete(name),
      update: () => {},
      destroy: () => {
        if (node) node.innerHTML = '';
      },
      mount: (target: HTMLElement) => {
        node = target;
        if (type === 'expressCheckout') {
          if (wallets)
            for (const name of ['Apple Pay', 'Google Pay']) {
              const b = window.document.createElement('button');
              b.type = 'button';
              b.textContent = name;
              b.onclick = () => callbacks.get('confirm')?.({ paymentFailed: () => {} });
              target.append(b);
            }
        } else {
          const label = window.document.createElement('label');
          label.textContent = 'Card number';
          const input = window.document.createElement('input');
          input.setAttribute('aria-label', 'Card number');
          label.append(input);
          target.append(label);
        }
      },
    };
  }
  const stripe = {
    _registerWrapper: () => {},
    registerAppInfo: () => {},
    createToken: () => {},
    createPaymentMethod: () => {},
    confirmCardPayment: () => {},
    elements: () => ({ create, submit: async () => ({}) }),
    confirmPayment: async () => {
      calls++;
      return calls === 1
        ? { error: { message: 'Your card was declined. Try another payment method.' } }
        : { paymentIntent: { status: 'succeeded' } };
    },
  };
  Object.assign(window, { Stripe: Object.assign(() => stripe, { version: 'endive' }) });
}
