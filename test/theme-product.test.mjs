import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const themeScript = await readFile(new URL('../assets/theme.js', import.meta.url), 'utf8');

const variants = [
  { id: 1, options: ['Framed', '12x18'], price: 24500, available: true, featured_image: null },
  { id: 2, options: ['Framed', '16x24'], price: 39500, available: true, featured_image: null },
  { id: 3, options: ['Metal', '12x18'], price: 27500, available: true, featured_image: null },
  { id: 4, options: ['Gallery Wrap', '12x18'], price: 22500, available: true, featured_image: null },
  { id: 5, options: ['Metal', '16x24'], price: 40000, available: false, featured_image: null },
];

function option(name, values, selected) {
  return `<fieldset data-option-index data-option-name="${name}" data-option-kind="${name.toLowerCase()}">
    <span data-selected-value></span>
    ${values.map((value) => `<input type="radio" name="${name}" value="${value}" ${value === selected ? 'checked' : ''}><label>${value}</label>`).join('')}
  </fieldset>`;
}

function previewCarousel(attribute) {
  return `<div data-preview-carousel hidden>
    <div ${attribute} hidden>
      <figure class="metal-lifestyle"></figure>
      <figure class="metal-lifestyle"></figure>
      <figure class="metal-lifestyle"></figure>
    </div>
    <button type="button" data-preview-previous disabled>Previous</button>
    <span data-preview-position>1 of 3</span>
    <button type="button" data-preview-next>Next</button>
  </div>`;
}

function productFixture() {
  return `<!doctype html><html><body>
    <section data-product data-finish-option="finish" data-frame-option="frame" data-mat-option="mat" data-money-format="\${{amount}}" data-base-image-src="https://example.com/art.jpg" data-base-image-alt="Artwork">
      <script type="application/json" data-product-json>${JSON.stringify(variants)}</script>
      <form id="product-form" action="/cart/add">
        <input name="id" value="1">
        ${option('Finish', ['Framed', 'Metal', 'Gallery Wrap'], 'Framed')}
        ${option('Size', ['12x18', '16x24'], '12x18')}
        <button data-add-to-cart>Add to cart</button>
      </form>
      <div data-price></div>
      <div class="frame-preview" data-frame-preview><img data-main-image src="https://example.com/art.jpg" alt="Artwork"></div>
      <p data-finish-caption>Finish preview</p>
      ${previewCarousel('data-metal-lifestyle')}
      ${previewCarousel('data-gallery-wrap-preview')}
      ${previewCarousel('data-framed-preview')}
    </section>
  </body></html>`;
}

function loadProduct() {
  const dom = new JSDOM(productFixture(), { url: 'https://example.com/products/art', runScripts: 'outside-only' });
  dom.window.requestAnimationFrame = (callback) => { callback(); return 1; };
  dom.window.cancelAnimationFrame = () => {};
  dom.window.eval(themeScript);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
  return dom;
}

function select(dom, name, value) {
  const input = [...dom.window.document.querySelectorAll(`input[name="${name}"]`)].find((candidate) => candidate.value === value);
  input.checked = true;
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

test('product finish and size selections update mat, price, variant, and previews', () => {
  const dom = loadProduct();
  const document = dom.window.document;
  const frame = document.querySelector('[data-frame-preview]');
  const caption = document.querySelector('[data-finish-caption]');
  const variantId = document.querySelector('input[name="id"]');
  const add = document.querySelector('[data-add-to-cart]');

  assert.equal(frame.classList.contains('mat-1-5'), true);
  assert.match(caption.textContent, /1\.5-inch double-white mat/);
  assert.equal(variantId.value, '1');
  assert.equal(document.querySelector('[data-price]').textContent, '$245');

  select(dom, 'Size', '16x24');
  assert.equal(frame.classList.contains('mat-2'), true);
  assert.equal(frame.classList.contains('mat-1-5'), false);
  assert.match(caption.textContent, /2-inch double-white mat/);
  assert.equal(variantId.value, '2');

  select(dom, 'Finish', 'Metal');
  assert.equal(frame.classList.contains('is-metal'), true);
  assert.equal(frame.classList.contains('has-mat'), false);
  assert.equal(document.querySelector('[data-metal-lifestyle]').hidden, false);
  assert.equal(document.querySelector('[data-framed-preview]').hidden, true);
  assert.equal(variantId.value, '5');
  assert.equal(add.disabled, true);
  assert.equal(add.textContent, 'Sold out');

  select(dom, 'Size', '12x18');
  select(dom, 'Finish', 'Gallery Wrap');
  assert.equal(frame.classList.contains('is-canvas'), true);
  assert.equal(document.querySelector('[data-gallery-wrap-preview]').hidden, false);
  assert.equal(document.querySelector('[data-metal-lifestyle]').hidden, true);
  assert.equal(variantId.value, '4');
  assert.equal(add.disabled, false);
});

test('product initialization is idempotent when Shopify reloads a section', () => {
  const dom = loadProduct();
  const root = dom.window.document.querySelector('[data-product]');
  dom.window.document.dispatchEvent(new dom.window.Event('shopify:section:load'));
  assert.equal(root.dataset.productReady, '1');
  select(dom, 'Finish', 'Metal');
  assert.equal(dom.window.document.querySelector('input[name="id"]').value, '3');
});

test('mobile preview arrows reveal and navigate all three lifestyle images', () => {
  const dom = loadProduct();
  const document = dom.window.document;
  const grid = document.querySelector('[data-metal-lifestyle]');
  const wrapper = grid.closest('[data-preview-carousel]');
  const items = [...grid.querySelectorAll(':scope > .metal-lifestyle')];
  Object.defineProperties(grid, {
    offsetLeft: { value: 0 },
    clientWidth: { value: 208 },
    scrollWidth: { value: 624 },
    scrollLeft: { value: 0, writable: true },
  });
  items.forEach((item, index) => Object.defineProperty(item, 'offsetLeft', { value: index * 208 }));
  grid.scrollTo = ({ left }) => {
    grid.scrollLeft = left;
    grid.dispatchEvent(new dom.window.Event('scroll'));
  };

  select(dom, 'Finish', 'Metal');
  assert.equal(wrapper.hidden, false);
  assert.equal(wrapper.querySelector('[data-preview-position]').textContent, '1 of 3');
  assert.equal(wrapper.querySelector('[data-preview-previous]').disabled, true);
  assert.equal(wrapper.querySelector('[data-preview-next]').disabled, false);

  wrapper.querySelector('[data-preview-next]').click();
  assert.equal(wrapper.querySelector('[data-preview-position]').textContent, '2 of 3');
  assert.equal(wrapper.querySelector('[data-preview-previous]').disabled, false);

  wrapper.querySelector('[data-preview-next]').click();
  assert.equal(wrapper.querySelector('[data-preview-position]').textContent, '3 of 3');
  assert.equal(wrapper.querySelector('[data-preview-next]').disabled, true);
});
