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

  function initAll() {
    document.querySelectorAll('[data-product]').forEach(initProduct);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
  // Re-initialise when sections are edited in the Shopify theme editor
  document.addEventListener('shopify:section:load', initAll);
})();
