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
    if (root.dataset.productReady) return;
    var dataEl = root.querySelector('[data-product-json]');
    if (!dataEl) return;
    var variants = JSON.parse(dataEl.textContent);
    var form = root.querySelector('form[action*="/cart/add"]');
    if (!form) return;
    root.dataset.productReady = '1';
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
    var finishCaption = root.querySelector('[data-finish-caption]');
    var finishOpt = (root.dataset.finishOption || 'finish').toLowerCase();
    var frameOpt = (root.dataset.frameOption || 'frame').toLowerCase();
    var matOpt = (root.dataset.matOption || 'mat').toLowerCase();
    var groups = Array.prototype.slice.call(root.querySelectorAll('[data-option-index]'));
    if (finishCaption) finishCaption.dataset.defaultCaption = finishCaption.textContent;

    function whccDetails(value) {
      var title = (value || '').trim();
      var sizeMatch = title.match(/\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?/i);
      var size = sizeMatch ? sizeMatch[0].replace(/\s+/g, '').replace('×', 'x') : title;
      var lower = title.toLowerCase();
      var finish = 'Print';
      if (/frame|framed/.test(lower)) finish = 'Framed';
      else if (/metal|aluminum|aluminium/.test(lower)) finish = 'Metal';
      else if (/canvas|gallery\s*wrap/.test(lower)) finish = 'Gallery Wrap';
      return { title: title, finish: finish, size: size };
    }

    function initWhccPicker() {
      var picker = root.querySelector('[data-whcc-picker]');
      var source = root.querySelector('[data-whcc-source]');
      if (!picker || !source) return;
      var finishContainer = picker.querySelector('[data-whcc-finishes]');
      var sizeContainer = picker.querySelector('[data-whcc-sizes]');
      var finishSelected = picker.querySelector('[data-whcc-finish-selected]');
      var sizeSelected = picker.querySelector('[data-whcc-size-selected]');
      var sourceInputs = Array.prototype.slice.call(source.querySelectorAll('input[type="radio"]'));
      var items = variants.map(function (variant) {
        var details = whccDetails(variant.options[0]);
        details.variant = variant;
        return details;
      });
      var checkedSource = source.querySelector('input:checked');
      var initial = whccDetails(checkedSource ? checkedSource.value : items[0].title);
      var currentFinish = initial.finish;
      var currentSize = initial.size;
      var finishPriority = { Framed: 0, Metal: 1, 'Gallery Wrap': 2, Print: 3 };

      function unique(values) {
        return values.filter(function (value, index) { return values.indexOf(value) === index; });
      }

      function sizeArea(value) {
        var parts = value.toLowerCase().split('x');
        return parts.length === 2 ? (parseFloat(parts[0]) || 0) * (parseFloat(parts[1]) || 0) : 0;
      }

      function updateRoomScale(value) {
        if (!frame || !root.querySelector('.product__stage--room')) return;
        var parts = value.toLowerCase().split('x');
        if (parts.length !== 2) return;
        var longEdge = Math.max(parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 0);
        var width = 40 + ((longEdge - 18) / 18) * 28;
        width = Math.max(34, Math.min(68, width));
        frame.style.setProperty('--room-artwork-width', width + '%');
      }

      function renderChoices(container, values, selectedValue, name, onChange) {
        container.innerHTML = '';
        values.forEach(function (value, index) {
          var id = form.id + '-' + name + '-' + index;
          var input = document.createElement('input');
          input.type = 'radio';
          input.id = id;
          input.name = form.id + '-' + name;
          input.value = value;
          input.checked = value === selectedValue;
          input.addEventListener('change', function () { if (input.checked) onChange(value); });
          var label = document.createElement('label');
          label.setAttribute('for', id);
          var content = document.createElement('span');
          content.className = 'option-value__content';
          var strong = document.createElement('strong');
          strong.textContent = value;
          content.appendChild(strong);
          label.appendChild(content);
          container.appendChild(input);
          container.appendChild(label);
        });
      }

      function selectSource(finish, size) {
        var item = items.find(function (candidate) { return candidate.finish === finish && candidate.size === size; });
        if (!item) return;
        var input = sourceInputs.find(function (candidate) { return candidate.value === item.title; });
        if (!input) return;
        currentFinish = finish;
        currentSize = size;
        input.checked = true;
        finishSelected.textContent = finish;
        sizeSelected.textContent = size;
        updateRoomScale(size);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      function renderSizes() {
        var sizes = unique(items.filter(function (item) { return item.finish === currentFinish; }).map(function (item) { return item.size; }));
        sizes.sort(function (a, b) { return sizeArea(a) - sizeArea(b); });
        if (sizes.indexOf(currentSize) === -1) currentSize = sizes[0];
        renderChoices(sizeContainer, sizes, currentSize, 'size', function (size) { selectSource(currentFinish, size); });
        sizeSelected.textContent = currentSize;
      }

      var finishes = unique(items.map(function (item) { return item.finish; }));
      finishes.sort(function (a, b) {
        var aPriority = Object.prototype.hasOwnProperty.call(finishPriority, a) ? finishPriority[a] : 99;
        var bPriority = Object.prototype.hasOwnProperty.call(finishPriority, b) ? finishPriority[b] : 99;
        return aPriority - bPriority;
      });
      renderChoices(finishContainer, finishes, currentFinish, 'finish', function (finish) {
        currentFinish = finish;
        renderSizes();
        selectSource(currentFinish, currentSize);
      });
      finishSelected.textContent = currentFinish;
      renderSizes();
      updateRoomScale(currentSize);
    }

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
      var frameColor = null, matColor = null, hasFrameOption = false, hasMatOption = false, finishValue = '';
      groups.forEach(function (g, i) {
        var name = (g.dataset.optionName || '').toLowerCase();
        var kind = (g.dataset.optionKind || '').toLowerCase();
        if (kind === 'finish' || name.indexOf(finishOpt) !== -1) finishValue = (values[i] || '').toLowerCase();
        else if (name.indexOf(frameOpt) !== -1) { hasFrameOption = true; frameColor = lookup(FRAME_COLORS, values[i]); }
        else if (name.indexOf(matOpt) !== -1) { hasMatOption = true; matColor = lookup(MAT_COLORS, values[i]); }
      });
      var isCanvas = /canvas/.test(finishValue);
      var isMetal = /metal|aluminum|aluminium/.test(finishValue);
      var isFramedFinish = /frame|matted/.test(finishValue);
      if (isCanvas || isMetal) {
        frameColor = null;
        matColor = null;
      } else if (isFramedFinish) {
        if (!hasFrameOption) frameColor = '#252522';
        if (!hasMatOption) matColor = '#f7f5ef';
      }
      frame.classList.toggle('is-canvas', isCanvas);
      frame.classList.toggle('is-metal', isMetal);
      frame.classList.toggle('is-framed', !!frameColor);
      frame.classList.toggle('has-mat', !!matColor);
      frame.style.setProperty('--frame-color', frameColor || 'transparent');
      frame.style.setProperty('--mat-color', matColor || 'transparent');
      if (finishCaption) {
        if (isCanvas) finishCaption.textContent = 'Canvas · Texture and depth preview';
        else if (isMetal) finishCaption.textContent = 'Metal · Clean and luminous preview';
        else if (isFramedFinish) finishCaption.textContent = 'Matted and framed · Finish preview';
        else finishCaption.textContent = finishCaption.dataset.defaultCaption || '';
      }
    }

    function updateAvailability(values) {
      groups.forEach(function (group, optionIndex) {
        group.querySelectorAll('input[type="radio"]').forEach(function (input) {
          var candidate = values.slice();
          candidate[optionIndex] = input.value;
          var available = variants.some(function (variant) {
            return variant.available && variant.options.every(function (optionValue, index) {
              return optionValue === candidate[index];
            });
          });
          var label = input.nextElementSibling;
          if (label) label.classList.toggle('is-unavailable', !available);
          input.setAttribute('aria-label', input.value + (available ? '' : ', unavailable with current selections'));
        });
      });
    }

    function update() {
      var values = selected();
      groups.forEach(function (g, i) {
        var label = g.querySelector('[data-selected-value]');
        if (label) label.textContent = values[i] || '';
      });
      updateFrame(values);
      updateAvailability(values);
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
    initWhccPicker();

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
