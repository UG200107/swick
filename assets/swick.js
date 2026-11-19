/**
 * Swick storefront behaviours (mobile-first, Snitch-style).
 * One module, loaded by every swick-* section via snippets/swick-assets.liquid.
 * Module scripts with the same URL execute once, so repeated tags are free.
 *
 * - <swick-slideshow>  swipe/scroll-snap carousel with arrows + optional autoplay
 * - <swick-tabs>       tab list that swaps product panels
 * - <swick-wishlist>   heart toggle persisted in localStorage
 * - <swick-quick-add>  "+" button: AJAX add for single-variant products, Horizon cart events
 * - <swick-bottom-nav> floating app-style nav: menu / cart drawer triggers + live cart count
 */
import { CartLinesUpdateEvent, CartErrorEvent, StandardEvents } from '@shopify/events';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Slideshow                                                          */
/* ------------------------------------------------------------------ */
class SwickSlideshow extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-swick-track]');
    this.slides = Array.from(this.querySelectorAll('[data-swick-slide]'));
    this.prev = this.querySelector('[data-swick-prev]');
    this.next = this.querySelector('[data-swick-next]');
    this.status = this.querySelector('[data-swick-status]');
    if (!this.track || this.slides.length < 2) return;

    this.index = 0;
    this.onPrev = () => this.go(this.index - 1, true);
    this.onNext = () => this.go(this.index + 1, true);
    this.onScroll = () => {
      window.cancelAnimationFrame(this.raf);
      this.raf = window.requestAnimationFrame(() => this.syncIndex());
    };
    this.onUser = () => this.stop();

    this.prev?.addEventListener('click', this.onPrev);
    this.next?.addEventListener('click', this.onNext);
    this.track.addEventListener('scroll', this.onScroll, { passive: true });
    this.track.addEventListener('pointerdown', this.onUser, { passive: true });
    this.track.addEventListener('touchstart', this.onUser, { passive: true });
    this.addEventListener('focusin', this.onUser);

    this.syncIndex();
    this.start();
  }

  disconnectedCallback() {
    this.stop();
    this.prev?.removeEventListener('click', this.onPrev);
    this.next?.removeEventListener('click', this.onNext);
    this.track?.removeEventListener('scroll', this.onScroll);
    this.track?.removeEventListener('pointerdown', this.onUser);
    this.track?.removeEventListener('touchstart', this.onUser);
    this.removeEventListener('focusin', this.onUser);
  }

  go(i, fromUser = false) {
    const count = this.slides.length;
    const target = (i + count) % count;
    if (fromUser) this.stop();
    this.track.scrollTo({
      left: this.slides[target].offsetLeft - this.track.offsetLeft,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  }

  syncIndex() {
    const width = this.track.clientWidth || 1;
    const i = Math.round(this.track.scrollLeft / width);
    this.index = Math.max(0, Math.min(this.slides.length - 1, i));
    this.slides.forEach((slide, n) => {
      const current = n === this.index;
      slide.toggleAttribute('inert', !current);
      slide.setAttribute('aria-hidden', String(!current));
    });
    if (this.status) {
      this.status.textContent = (this.status.dataset.template || '')
        .replace('[index]', String(this.index + 1))
        .replace('[length]', String(this.slides.length));
    }
  }

  start() {
    const seconds = Number(this.dataset.autoplay || 0);
    if (!seconds || reducedMotion()) return;
    this.timer = window.setInterval(() => this.go(this.index + 1), seconds * 1000);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
  }
}

/* ------------------------------------------------------------------ */
/* Tabs                                                               */
/* ------------------------------------------------------------------ */
class SwickTabs extends HTMLElement {
  connectedCallback() {
    this.tabs = Array.from(this.querySelectorAll('[role="tab"]'));
    this.panels = Array.from(this.querySelectorAll('[role="tabpanel"]'));
    this.onClick = (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tab && this.tabs.includes(tab)) this.select(tab);
    };
    this.onKey = (event) => {
      const i = this.tabs.indexOf(document.activeElement);
      if (i < 0) return;
      let next = null;
      if (event.key === 'ArrowRight') next = this.tabs[(i + 1) % this.tabs.length];
      if (event.key === 'ArrowLeft') next = this.tabs[(i - 1 + this.tabs.length) % this.tabs.length];
      if (event.key === 'Home') next = this.tabs[0];
      if (event.key === 'End') next = this.tabs[this.tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      this.select(next);
      next.focus();
    };
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('keydown', this.onKey);
  }

  select(tab) {
    this.tabs.forEach((t) => {
      const active = t === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    this.panels.forEach((panel) => {
      panel.hidden = panel.id !== tab.getAttribute('aria-controls');
    });
    tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

/* ------------------------------------------------------------------ */
/* Wishlist (local only — no account sync)                            */
/* ------------------------------------------------------------------ */
const WISHLIST_KEY = 'swick:wishlist';

function readWishlist() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(WISHLIST_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function writeWishlist(set) {
  try {
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify([...set]));
  } catch {
    /* storage blocked — the toggle still works for this page view */
  }
}

class SwickWishlist extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    this.handle = this.dataset.handle;
    if (!this.button || !this.handle) return;
    this.render(readWishlist().has(this.handle));
    this.onClick = () => {
      const list = readWishlist();
      const saved = !list.has(this.handle);
      if (saved) list.add(this.handle);
      else list.delete(this.handle);
      writeWishlist(list);
      this.render(saved);
      document.querySelectorAll(`swick-wishlist[data-handle="${CSS.escape(this.handle)}"]`).forEach((el) => {
        if (el !== this && typeof el.render === 'function') el.render(saved);
      });
    };
    this.button.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.button?.removeEventListener('click', this.onClick);
  }

  render(saved) {
    this.button?.setAttribute('aria-pressed', String(saved));
  }
}

/* ------------------------------------------------------------------ */
/* Cart helper — mirrors Horizon's product-form flow so the theme's    */
/* cart drawer, cart icon and cart items react exactly as they do for   */
/* its own add-to-cart.                                                 */
/* ------------------------------------------------------------------ */
const routeRoot = () => (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

/**
 * @param {HTMLElement} source - element that dispatches the cart event
 * @param {string|number} variantId
 * @param {number} [quantity]
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function swickAddToCart(source, variantId, quantity = 1) {
  const sectionIds = Array.from(document.querySelectorAll('cart-items-component'))
    .map((el) => el instanceof HTMLElement && el.dataset.sectionId)
    .filter(Boolean);

  const deferred = CartLinesUpdateEvent.createPromise();
  source.dispatchEvent(
    new CartLinesUpdateEvent({
      action: 'add',
      context: 'product',
      lines: [{ merchandiseId: String(variantId), quantity }],
      promise: deferred.promise,
    })
  );

  try {
    const response = await fetch(`${routeRoot()}cart/add.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity }], sections: sectionIds.join(',') }),
    });
    const data = await response.json();
    const ajaxCart = await (await fetch(`${routeRoot()}cart.js`, { headers: { Accept: 'application/json' } })).json();
    const failed = !response.ok || Boolean(data.status);

    if (failed) {
      source.dispatchEvent(
        new CartErrorEvent({
          error: data.message || 'Add to cart failed',
          code: 'INVALID',
          detail: { description: data.description },
        })
      );
    }

    deferred.resolve({
      cart: CartLinesUpdateEvent.createCartFromAjaxResponse(ajaxCart),
      detail: {
        didError: failed,
        items: ajaxCart.items,
        source: 'swick',
        itemCount: quantity,
        sections: failed ? undefined : data.sections,
      },
    });

    return { ok: !failed, message: failed ? data.description || data.message || '' : '' };
  } catch (error) {
    deferred.reject(error);
    return { ok: false, message: '' };
  }
}

/* Keep every [data-swick-cart-count] badge in sync with the cart. */
document.addEventListener(StandardEvents.cartLinesUpdate, (event) => {
  event.promise
    ?.then(({ cart, detail }) => {
      const count = cart?.totalQuantity ?? detail?.itemCount ?? 0;
      document.querySelectorAll('[data-swick-cart-count]').forEach((el) => {
        el.textContent = count > 99 ? '99+' : String(count);
        el.hidden = count === 0;
      });
    })
    .catch(() => {});
});

const openCartDrawer = () => {
  const trigger = document.querySelector('[data-testid="cart-drawer-trigger"]');
  if (!trigger) return false;
  trigger.click();
  return true;
};

/* ------------------------------------------------------------------ */
/* Quick add                                                          */
/* ------------------------------------------------------------------ */
class SwickQuickAdd extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    if (!this.button) return;
    this.onClick = () => this.add();
    this.button.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.button?.removeEventListener('click', this.onClick);
  }

  async add() {
    const variantId = this.dataset.variantId;
    if (!variantId || this.button.getAttribute('aria-busy') === 'true') return;
    this.button.setAttribute('aria-busy', 'true');
    this.button.classList.add('is-loading');
    const result = await swickAddToCart(this, variantId, 1);
    this.button.removeAttribute('aria-busy');
    this.button.classList.remove('is-loading');
    this.flash(result.ok ? this.dataset.addedLabel || '' : result.message);
  }

  flash(message) {
    const live = this.querySelector('[data-swick-live]');
    if (!live) return;
    live.textContent = message;
    window.setTimeout(() => (live.textContent = ''), 3000);
  }
}

/* ------------------------------------------------------------------ */
/* Bottom nav                                                         */
/* ------------------------------------------------------------------ */
class SwickBottomNav extends HTMLElement {
  connectedCallback() {
    this.onClick = (event) => {
      const action = event.target.closest('[data-swick-action]');
      if (!action) return;
      const kind = action.dataset.swickAction;

      if (kind === 'menu') {
        const summary = document.querySelector('header-drawer summary');
        if (summary) {
          event.preventDefault();
          summary.click();
        }
      }

      if (kind === 'cart') {
        if (openCartDrawer()) event.preventDefault();
      }

      if (kind === 'search') {
        const trigger = document.querySelector('.search-action button, [data-testid="search-button"]');
        if (trigger) {
          event.preventDefault();
          trigger.click();
        }
      }
    };

    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
  }
}

/* ------------------------------------------------------------------ */
/* Money                                                              */
/* ------------------------------------------------------------------ */
function formatMoney(cents, format) {
  const fmt = format || '₹{{amount}}';
  const group = (n, sep) => n.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const fixed = (decimals, thousands, decimal) => {
    const [whole, frac] = (cents / 100).toFixed(decimals).split('.');
    let out = group(whole, thousands);
    if (frac && frac !== '00') out += decimal + frac; // "without trailing zeros", like the Liquid filter
    return out;
  };
  return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
    switch (key) {
      case 'amount_no_decimals':
        return fixed(0, ',', '.');
      case 'amount_with_comma_separator':
        return fixed(2, '.', ',');
      case 'amount_no_decimals_with_comma_separator':
        return fixed(0, '.', ',');
      case 'amount_with_apostrophe_separator':
        return fixed(2, "'", '.');
      default:
        return fixed(2, ',', '.');
    }
  });
}

/* ------------------------------------------------------------------ */
/* Product page                                                       */
/* ------------------------------------------------------------------ */
class SwickProduct extends HTMLElement {
  connectedCallback() {
    const json = this.querySelector('[data-swick-product]');
    if (!json) return;
    try {
      this.product = JSON.parse(json.textContent);
    } catch {
      return;
    }

    this.form = this.querySelector('[data-swick-form]');
    this.input = this.querySelector('[data-swick-variant-input]');
    this.atc = this.querySelector('[data-swick-atc]');
    this.atcStatus = this.querySelector('[data-swick-atc-status]');
    this.error = this.querySelector('[data-swick-option-error]');
    this.fieldsets = Array.from(this.querySelectorAll('[data-swick-option]'));
    this.gallery = this.querySelector('swick-slideshow');
    this.topbar = this.querySelector('[data-swick-topbar]');

    this.selected = this.fieldsets.map((fs) => {
      const pressed = fs.querySelector('[aria-pressed="true"]');
      return pressed ? pressed.dataset.value : null;
    });

    this.onOptionClick = (event) => {
      const btn = event.target.closest('.swick-pdp__value');
      if (!btn) return;
      const fs = btn.closest('[data-swick-option]');
      const i = Number(fs.dataset.swickOption);
      this.selected[i] = btn.dataset.value;
      this.update(true);
    };
    this.onSubmit = (event) => {
      event.preventDefault();
      this.addToBag();
    };
    this.onTopbarClick = (event) => this.handleTopbar(event);
    this.onScroll = () => {
      window.cancelAnimationFrame(this.raf);
      this.raf = window.requestAnimationFrame(() => {
        this.topbar?.classList.toggle('is-solid', window.scrollY > (this.gallery?.offsetHeight || 400) - 80);
      });
    };

    this.form?.addEventListener('click', this.onOptionClick);
    this.form?.addEventListener('submit', this.onSubmit);
    this.topbar?.addEventListener('click', this.onTopbarClick);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.querySelector('[data-swick-open-reviews]')?.addEventListener('click', () => {
      const target = this.querySelector('[id^="SwickReviews-"]');
      if (target) target.open = true;
    });

    this.onScroll();
    this.update(false);
  }

  disconnectedCallback() {
    this.form?.removeEventListener('click', this.onOptionClick);
    this.form?.removeEventListener('submit', this.onSubmit);
    this.topbar?.removeEventListener('click', this.onTopbarClick);
    window.removeEventListener('scroll', this.onScroll);
  }

  get variant() {
    if (this.product.variants.length === 1 && this.fieldsets.length === 0) return this.product.variants[0];
    if (this.selected.some((v) => v == null)) return null;
    return this.product.variants.find((v) => v.options.every((opt, i) => opt === this.selected[i])) || null;
  }

  missingOption() {
    const i = this.selected.findIndex((v) => v == null);
    return i < 0 ? null : this.fieldsets[i];
  }

  update(fromUser) {
    const variant = this.variant;

    // Option UI: pressed state, visible value, availability given the other choices.
    this.fieldsets.forEach((fs, i) => {
      fs.classList.toggle('is-done', this.selected[i] != null);
      const label = fs.querySelector('[data-swick-option-value]');
      if (label) label.innerHTML = this.selected[i] != null ? '<span aria-hidden="true"> · </span>' : '';
      if (label && this.selected[i] != null) label.append(document.createTextNode(this.selected[i]));

      fs.querySelectorAll('.swick-pdp__value').forEach((btn) => {
        const value = btn.dataset.value;
        btn.setAttribute('aria-pressed', String(value === this.selected[i]));
        const possible = this.product.variants.some(
          (v) => v.available && v.options[i] === value && v.options.every((o, j) => j === i || this.selected[j] == null || o === this.selected[j])
        );
        btn.classList.toggle('is-unavailable', !possible);
      });
    });

    if (this.error && !this.missingOption()) this.error.hidden = true;

    const shown = variant || this.product.variants.find((v) => v.available) || this.product.variants[0];
    this.renderPrice(shown);

    if (this.input) this.input.value = variant ? variant.id : '';

    if (this.atc) {
      const soldOut = !this.product.available || (variant && !variant.available);
      this.atc.disabled = Boolean(soldOut);
      this.atc.textContent = soldOut ? this.atc.dataset.labelSoldout : this.atc.dataset.labelAdd;
    }

    if (variant) {
      this.dispatchEvent(new CustomEvent('swick:variant-change', { bubbles: true, detail: { variant } }));
      if (fromUser) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }
    }

    // Jump the gallery to the chosen value's image.
    if (fromUser && this.gallery) {
      const mediaId = variant?.featured_media?.id ?? this.firstMediaForSelection();
      if (mediaId) {
        const slides = Array.from(this.gallery.querySelectorAll('[data-swick-slide]'));
        const index = slides.findIndex((s) => s.dataset.mediaId === String(mediaId));
        if (index >= 0 && typeof this.gallery.go === 'function') this.gallery.go(index, true);
      }
    }
  }

  firstMediaForSelection() {
    const match = this.product.variants.find(
      (v) => v.featured_media && v.options.every((o, i) => this.selected[i] == null || o === this.selected[i])
    );
    return match?.featured_media?.id;
  }

  renderPrice(variant) {
    const fmt = this.dataset.moneyFormat;
    const price = this.querySelector('[data-swick-price]');
    const compare = this.querySelector('[data-swick-compare]');
    const off = this.querySelector('[data-swick-off]');
    if (price) price.textContent = formatMoney(variant.price, fmt);
    const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
    if (compare) {
      compare.hidden = !onSale;
      if (onSale) compare.textContent = formatMoney(variant.compare_at_price, fmt);
    }
    if (off) {
      off.hidden = !onSale;
      if (onSale) off.textContent = `${Math.floor(((variant.compare_at_price - variant.price) * 100) / variant.compare_at_price)}% OFF`;
    }
  }

  async addToBag() {
    const missing = this.missingOption();
    if (missing) {
      const name = missing.dataset.optionName || '';
      if (this.error) {
        this.error.textContent = `Please select a ${name.toLowerCase()}`;
        this.error.hidden = false;
      }
      this.form.classList.remove('is-shaking');
      void this.form.offsetWidth;
      this.form.classList.add('is-shaking');
      missing.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      missing.querySelector('.swick-pdp__value')?.focus({ preventScroll: true });
      return;
    }

    const variant = this.variant;
    if (!variant || !variant.available || this.atc.getAttribute('aria-busy') === 'true') return;

    this.atc.setAttribute('aria-busy', 'true');
    this.atc.textContent = this.atc.dataset.labelAdding;
    const result = await swickAddToCart(this, variant.id, 1);
    this.atc.removeAttribute('aria-busy');

    if (result.ok) {
      this.atc.textContent = this.atc.dataset.labelAdded;
      this.atc.classList.add('is-added');
      if (this.atcStatus) this.atcStatus.textContent = this.atc.dataset.labelAdded;
      window.setTimeout(() => {
        this.atc.classList.remove('is-added');
        this.atc.textContent = this.atc.dataset.labelAdd;
        if (this.atcStatus) this.atcStatus.textContent = '';
      }, 1800);
    } else {
      this.atc.textContent = this.atc.dataset.labelAdd;
      if (this.error) {
        this.error.textContent = result.message || 'Could not add to bag. Please try again.';
        this.error.hidden = false;
      }
    }
  }

  async handleTopbar(event) {
    const back = event.target.closest('[data-swick-back]');
    if (back) {
      let sameSite = false;
      try {
        sameSite = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
      } catch {
        sameSite = false;
      }
      if (sameSite && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
      return;
    }

    if (event.target.closest('[data-swick-open-cart]')) {
      if (openCartDrawer()) event.preventDefault();
      return;
    }

    const share = event.target.closest('[data-swick-share]');
    if (share) {
      const data = { title: share.dataset.title || document.title, url: window.location.href };
      const status = this.querySelector('[data-swick-share-status]');
      try {
        if (navigator.share) {
          await navigator.share(data);
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(data.url);
          if (status) status.textContent = 'Link copied';
          share.classList.add('is-copied');
          window.setTimeout(() => {
            share.classList.remove('is-copied');
            if (status) status.textContent = '';
          }, 2000);
        }
      } catch {
        /* share sheet dismissed */
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Pincode delivery estimate (date window from section settings;      */
/* no courier lookup)                                                 */
/* ------------------------------------------------------------------ */
const PIN_KEY = 'swick:pincode';

class SwickPincode extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('[data-swick-pin-form]');
    this.input = this.querySelector('[data-swick-pin-input]');
    this.msg = this.querySelector('[data-swick-pin-msg]');
    this.product = this.closest('swick-product');
    if (!this.form || !this.input) return;

    try {
      const saved = window.localStorage.getItem(PIN_KEY);
      if (saved) this.input.value = saved;
    } catch {
      /* storage blocked */
    }

    this.onInput = () => {
      this.input.value = this.input.value.replace(/\D/g, '').slice(0, 6);
    };
    this.onSubmit = (event) => {
      event.preventDefault();
      this.check();
    };
    this.onVariant = () => {
      if (this.input.value.length === 6 && !this.msg.hidden) this.check();
    };
    this.input.addEventListener('input', this.onInput);
    this.form.addEventListener('submit', this.onSubmit);
    this.product?.addEventListener('swick:variant-change', this.onVariant);
  }

  disconnectedCallback() {
    this.input?.removeEventListener('input', this.onInput);
    this.form?.removeEventListener('submit', this.onSubmit);
    this.product?.removeEventListener('swick:variant-change', this.onVariant);
  }

  show(text, warn) {
    this.msg.textContent = text;
    this.msg.classList.toggle('is-warn', Boolean(warn));
    this.msg.hidden = false;
  }

  check() {
    const missing = this.product && typeof this.product.missingOption === 'function' ? this.product.missingOption() : null;
    if (missing) {
      const name = (missing.dataset.optionName || 'option').toLowerCase();
      this.show((this.dataset.selectMsg || 'Please select your [option]').replace('[option]', name), true);
      return;
    }

    const pin = this.input.value.trim();
    if (!/^[1-9]\d{5}$/.test(pin)) {
      this.show('Please enter a valid 6-digit pincode', true);
      return;
    }

    const blocked = (this.dataset.blocked || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (blocked.some((prefix) => pin.startsWith(prefix))) {
      this.show("Sorry, we don't deliver to this pincode yet", true);
      return;
    }

    try {
      window.localStorage.setItem(PIN_KEY, pin);
    } catch {
      /* storage blocked */
    }

    const min = Number(this.dataset.minDays || 3);
    const max = Math.max(min, Number(this.dataset.maxDays || 6));
    const fmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const day = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return fmt.format(d);
    };
    const window_ = min === max ? day(min) : `${day(min)} – ${day(max)}`;
    const extra = this.dataset.cod ? ` · ${this.dataset.cod}` : '';
    this.show(`Estimated delivery ${window_} to ${pin}${extra}`, false);
  }
}

/* ------------------------------------------------------------------ */
/* Recommendations                                                    */
/* ------------------------------------------------------------------ */
class SwickRecommendations extends HTMLElement {
  connectedCallback() {
    if (this.dataset.loaded === 'true' || !this.dataset.url) return;
    this.load();
  }

  async load() {
    try {
      const response = await fetch(this.dataset.url);
      if (!response.ok) throw new Error(String(response.status));
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('swick-recommendations');
      if (!fresh || fresh.dataset.empty === 'true') {
        this.closest('.shopify-section')?.setAttribute('hidden', '');
        return;
      }
      this.dataset.loaded = 'true';
      this.innerHTML = fresh.innerHTML;
    } catch {
      this.closest('.shopify-section')?.setAttribute('hidden', '');
    }
  }
}

const define = (name, ctor) => {
  if (!customElements.get(name)) customElements.define(name, ctor);
};

define('swick-slideshow', SwickSlideshow);
define('swick-tabs', SwickTabs);
define('swick-wishlist', SwickWishlist);
define('swick-quick-add', SwickQuickAdd);
define('swick-bottom-nav', SwickBottomNav);
define('swick-product', SwickProduct);
define('swick-pincode', SwickPincode);
define('swick-recommendations', SwickRecommendations);
