import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const themeScript = await readFile(new URL('../assets/theme.js', import.meta.url), 'utf8');

const variants = [
  { id: 1, options: ['Framed', '12x18'], price: 24500, available: true, featured_image: { src: 'https://example.com/legacy-1-5.jpg', alt: 'Artwork in the WHCC Gallery Slim black frame with 1.5-inch double-white mat' } },
  { id: 2, options: ['Framed', '16x24'], price: 39500, available: true, featured_image: { src: 'https://example.com/legacy-2.jpg', alt: 'Artwork in the WHCC Gallery Slim black frame with 2-inch double-white mat' } },
  { id: 3, options: ['Metal', '12x18'], price: 27500, available: true, featured_image: null },
  { id: 4, options: ['Gallery Wrap', '12x18'], price: 22500, available: true, featured_image: null },
  { id: 5, options: ['Metal', '16x24'], price: 40000, available: false, featured_image: null },
  { id: 6, options: ['Framed', '24x36'], price: 70000, available: true, featured_image: { src: 'https://example.com/legacy-2.jpg', alt: 'Artwork in the WHCC Gallery Slim black frame with 2-inch double-white mat' } },
];

function option(name, values, selected) {
  return `<fieldset data-option-index data-option-name="${name}" data-option-kind="${name.toLowerCase()}">
    <span data-selected-value></span>
    ${values.map((value) => `<input type="radio" name="${name}" value="${value}" ${value === selected ? 'checked' : ''}><label>${value}</label>`).join('')}
  </fieldset>`;
}

function productFixture() {
  return `<!doctype html><html><body>
    <section data-product data-finish-option="finish" data-frame-option="frame" data-mat-option="mat" data-money-format="\${{amount}}" data-base-image-src="https://example.com/art.jpg" data-base-image-alt="Artwork">
      <script type="application/json" data-product-json>${JSON.stringify(variants)}</script>
      <form id="product-form" action="/cart/add">
        <input name="id" value="1">
        ${option('Finish', ['Framed', 'Metal', 'Gallery Wrap'], 'Framed')}
        ${option('Size', ['12x18', '16x24', '24x36'], '12x18')}
        <button data-add-to-cart>Add to cart</button>
      </form>
      <div data-price></div>
      <div class="frame-preview" data-frame-preview><img data-main-image src="https://example.com/art.jpg" alt="Artwork"></div>
      <p data-finish-caption>Finish preview</p>
      <div data-metal-lifestyle hidden></div>
      <div data-gallery-wrap-preview hidden></div>
      <div data-framed-preview hidden>
        <div data-framed-visual data-framed-layout="wall" data-framed-orientation="landscape"><div class="framed-preview__art-panel"></div></div>
        <div data-framed-visual data-framed-layout="edge" data-framed-orientation="landscape"><div class="framed-preview__art-panel"></div></div>
        <div data-framed-visual data-framed-layout="room" data-framed-orientation="landscape"></div>
      </div>
      <button type="button" data-product-lightbox-open>Enlarge</button>
      <dialog data-product-lightbox>
        <button type="button" data-product-lightbox-close>Close</button>
        <div class="product-lightbox__image-wrap">
          <div class="frame-preview product-lightbox__preview" data-product-lightbox-preview>
            <img data-product-lightbox-image src="https://example.com/art.jpg" alt="Artwork">
          </div>
        </div>
      </dialog>
    </section>
  </body></html>`;
}

function loadProduct() {
  const dom = new JSDOM(productFixture(), { url: 'https://example.com/products/art', runScripts: 'outside-only' });
  dom.window.requestAnimationFrame = (callback) => { callback(); return 1; };
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const lightbox = dom.window.document.querySelector('[data-product-lightbox]');
  Object.defineProperty(lightbox, 'clientWidth', { configurable: true, value: 1800 });
  Object.defineProperty(lightbox, 'clientHeight', { configurable: true, value: 900 });
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
  assert.equal(frame.style.getPropertyValue('--mat-width'), 'clamp(14px, 3.4vw, 35px)');
  assert.equal(document.querySelector('[data-main-image]').src, 'https://example.com/art.jpg');
  assert.equal(document.querySelector('[data-framed-layout="wall"]').dataset.framedOpeningScaleX, '1.0000');
  assert.equal(document.querySelector('[data-framed-layout="wall"] .framed-preview__art-panel').style.width, '56.7%');
  assert.match(caption.textContent, /1\.5-inch double-white mat/);
  assert.equal(variantId.value, '1');
  assert.equal(document.querySelector('[data-price]').textContent, '$245');

  select(dom, 'Size', '16x24');
  assert.equal(frame.classList.contains('mat-2'), true);
  assert.equal(frame.classList.contains('mat-1-5'), false);
  assert.match(caption.textContent, /2-inch double-white mat/);
  assert.equal(variantId.value, '2');
  assert.equal(frame.style.getPropertyValue('--mat-width'), 'clamp(14px, 3.4vw, 35px)');
  assert.equal(document.querySelector('[data-main-image]').src, 'https://example.com/art.jpg');
  assert.equal(document.querySelector('[data-framed-layout="edge"]').dataset.framedOpeningScaleX, '1.0000');

  select(dom, 'Size', '24x36');
  assert.equal(variantId.value, '6');
  assert.equal(frame.style.getPropertyValue('--mat-width'), 'clamp(9.33px, 2.27vw, 23.33px)');
  assert.equal(frame.style.getPropertyValue('--frame-width'), 'clamp(5px, 0.9vw, 9px)');
  assert.equal(document.querySelector('[data-main-image]').src, 'https://example.com/art.jpg');
  assert.equal(document.querySelector('[data-framed-layout="wall"]').dataset.framedOpeningScaleX, '1.0667');
  assert.equal(document.querySelector('[data-framed-layout="wall"]').dataset.framedOpeningScaleY, '1.1111');
  assert.equal(document.querySelector('[data-framed-layout="wall"] .framed-preview__art-panel').style.width, '60.48%');
  assert.equal(document.querySelector('[data-framed-layout="edge"] .framed-preview__art-panel').style.width, '80.22%');

  select(dom, 'Size', '16x24');
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

test('enlarged framed preview scales mat and frame to the selected physical size', () => {
  const dom = loadProduct();
  const document = dom.window.document;
  const open = document.querySelector('[data-product-lightbox-open]');
  const preview = document.querySelector('[data-product-lightbox-preview]');
  const image = document.querySelector('[data-product-lightbox-image]');

  open.click();
  const firstMat = parseFloat(preview.style.getPropertyValue('--mat-width'));
  const firstFrame = parseFloat(preview.style.getPropertyValue('--frame-width'));
  const firstHeight = parseFloat(image.style.height);
  assert.ok(Math.abs((firstMat / firstHeight) - (1.5 / 12)) < 0.0001);
  assert.ok(Math.abs((firstFrame / firstHeight) - (0.5625 / 12)) < 0.0001);

  select(dom, 'Size', '24x36');
  open.click();
  const largeMat = parseFloat(preview.style.getPropertyValue('--mat-width'));
  const largeFrame = parseFloat(preview.style.getPropertyValue('--frame-width'));
  const largeHeight = parseFloat(image.style.height);
  assert.ok(Math.abs((largeMat / largeHeight) - (2 / 24)) < 0.0001);
  assert.ok(Math.abs((largeFrame / largeHeight) - (0.5625 / 24)) < 0.0001);
  assert.ok(largeHeight > firstHeight);
});
