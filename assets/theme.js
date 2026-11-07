/* Gallery theme scripts: quantity steppers, product option picker, frame preview. */
(function () {
  // Quantity steppers
  document.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-qty-step]');
    if (!btn) return;
    var input = btn.parentElement.querySelector('input');
    var next = (parseInt(input.value, 10) || 1) + parseInt(btn.dataset.qtyStep, 10);
    input.value = Math.max(1, next);
  });

  // Cart sort / product sort dropdowns
  document.addEventListener('change', function (event) {
    var select = event.target.closest('[data-sort-by]');
    if (!select) return;
    var url = new URL(window.location.href);
    url.searchParams.set('sort_by', select.value);
    window.location.href = url.toString();
  });

  var FRAME_COLORS = [
    [/(no frame|unframed|^none$|without)/, null],
    [/black|ebony|charcoal/, '#1d1d1d'],
    [/white|snow/, '#f3f2ef'],
    [/walnut|espresso|brown|mahogany|dark wood/, '#5b3e2b'],
    [/oak|natural|maple|wood|ash|birch|light wood/, '#b68a59'],
    [/gold|brass/, '#b8973a'],
    [/silver|aluminum|aluminium|metal/, '#a9aaae'],
    [/grey|gray/, '#808080']
  ];
  var MAT_COLORS = [
    [/(no mat|without|^none$|^no$)/, null],
    [/black/, '#151515'],
    [/off.?white|cream|ivory|warm/, '#f2ede2'],
    [/grey|gray/, '#cfcfcf'],
    [/.*/, '#ffffff']
  ];

  function lookup(table, value) {
    var v = (value || '').toLowerCase().trim();
    for (var i = 0; i < table.length; i++) {
      if (table[i][0].test(v)) return table[i][1];
    }
    return '#2a2a2a';
  }

  function initProduct(root) {
    var dataEl = root.querySelector('[data-product-json]');
    if (!dataEl) return;
    var variants = JSON.parse(dataEl.textContent);
    var form = root.querySelector('form[action*="/cart/add"]');
    if (!form) return;
    root.querySelectorAll('[data-swatch]').forEach(function (s) {
      var table = s.dataset.swatch === 'mat' ? MAT_COLORS : FRAME_COLORS;
      var color = lookup(table, s.dataset.swatchValue);
      if (color) s.style.setProperty('--swatch', color);
      else s.style.setProperty('--swatch', 'repeating-linear-gradient(45deg, #fff 0 3px, #ddd 3px 6px)');
    });
    var idInput = form.querySelector('input[name="id"]');
    var priceEl = root.querySelector('[data-price]');
    var addBtn = form.querySelector('[data-add-to-cart]');
    var frame = root.querySelector('[data-frame-preview]');
    var mainImg = root.querySelector('[data-main-image]');
    var frameOpt = (root.dataset.frameOption || 'frame').toLowerCase();
    var matOpt = (root.dataset.matOption || 'mat').toLowerCase();
    var groups = Array.prototype.slice.call(root.querySelectorAll('[data-option-index]'));

    function selected() {
      return groups.map(function (g) {
        var checked = g.querySelector('input:checked');
        return checked ? checked.value : null;
      });
    }

    function findVariant(values) {
      return variants.find(function (v) {
        return v.options.every(function (o, i) { return o === values[i]; });
      });
    }

    function money(cents) {
      var fmt = root.dataset.moneyFormat || '${{amount}}';
      var amount = (cents / 100).toFixed(2);
      return fmt.replace(/\{\{\s*amount[a-z_]*\s*\}\}/, amount.replace(/\.00$/, ''));
    }

    function updateFrame(values) {
      if (!frame) return;
      var frameColor = null, matColor = null, hasFrameOption = false, hasMatOption = false;
      groups.forEach(function (g, i) {
        var name = (g.dataset.optionName || '').toLowerCase();
        if (name.indexOf(frameOpt) !== -1) { hasFrameOption = true; frameColor = lookup(FRAME_COLORS, values[i]); }
        else if (name.indexOf(matOpt) !== -1) { hasMatOption = true; matColor = lookup(MAT_COLORS, values[i]); }
      });
      frame.classList.toggle('is-framed', hasFrameOption && !!frameColor);
      frame.classList.toggle('has-mat', hasMatOption && !!matColor);
      frame.style.setProperty('--frame-color', frameColor || 'transparent');
      frame.style.setProperty('--mat-color', matColor || 'transparent');
    }

    function update() {
      var values = selected();
      groups.forEach(function (g, i) {
        var label = g.querySelector('[data-selected-value]');
        if (label) label.textContent = values[i] || '';
      });
      updateFrame(values);
      var variant = findVariant(values);
      if (!variant) {
        addBtn.disabled = true;
        addBtn.textContent = 'Unavailable';
        return;
      }
      idInput.value = variant.id;
      if (priceEl) {
        var html = money(variant.price);
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          html += ' <s>' + money(variant.compare_at_price) + '</s>';
        }
        priceEl.innerHTML = html;
      }
      addBtn.disabled = !variant.available;
      addBtn.textContent = variant.available ? 'Add to cart' : 'Sold out';
      if (variant.featured_image && mainImg) {
        mainImg.src = variant.featured_image.src;
        mainImg.removeAttribute('srcset');
      }
      var url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    }

    groups.forEach(function (g) { g.addEventListener('change', update); });

    root.querySelectorAll('[data-thumb]').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        if (!mainImg) return;
        mainImg.src = thumb.dataset.thumb;
        mainImg.removeAttribute('srcset');
        root.querySelectorAll('[data-thumb]').forEach(function (t) { t.setAttribute('aria-current', 'false'); });
        thumb.setAttribute('aria-current', 'true');
      });
    });

    update();
  }

  function initSlideshow(root) {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-slide]'));
    if (slides.length < 2) return;
    var section = root.closest('section') || root.parentElement;
    var dots = Array.prototype.slice.call(section.querySelectorAll('[data-slide-dot]'));
    var current = 0;
    var timer = null;
    var delay = parseInt(root.dataset.autoplay, 10) || 0;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function go(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === current); });
      dots.forEach(function (d, i) { d.setAttribute('aria-current', i === current ? 'true' : 'false'); });
    }
    function start() {
      stop();
      if (delay > 0 && !reduceMotion) timer = setInterval(function () { go(current + 1); }, delay * 1000);
    }
    function stop() { if (timer) clearInterval(timer); timer = null; }

    var prev = root.querySelector('[data-slide-prev]');
    var next = root.querySelector('[data-slide-next]');
    if (prev) prev.addEventListener('click', function () { go(current - 1); start(); });
    if (next) next.addEventListener('click', function () { go(current + 1); start(); });
    dots.forEach(function (d) {
      d.addEventListener('click', function () { go(parseInt(d.dataset.slideDot, 10)); start(); });
    });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);

    // Swipe on phones
    var startX = null;
    root.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) { go(current + (dx < 0 ? 1 : -1)); start(); }
      startX = null;
    });

    // Theme editor: show the slide being edited
    document.addEventListener('shopify:block:select', function (e) {
      var i = slides.indexOf(e.target);
      if (i !== -1) { stop(); go(i); }
    });

    start();
  }

  function initAll() {
    document.querySelectorAll('[data-product]').forEach(initProduct);
    document.querySelectorAll('[data-slideshow]').forEach(initSlideshow);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
  // Re-initialise when sections are edited in the Shopify theme editor
  document.addEventListener('shopify:section:load', initAll);
})();
