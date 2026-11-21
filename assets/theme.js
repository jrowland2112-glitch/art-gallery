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
    var baseImageSrc = root.dataset.baseImageSrc || '';
    var baseImageAlt = root.dataset.baseImageAlt || '';
    var lightbox = root.querySelector('[data-product-lightbox]');
    var lightboxImg = root.querySelector('[data-product-lightbox-image]');
    var lightboxPreview = root.querySelector('[data-product-lightbox-preview]');
    var lightboxOpen = root.querySelector('[data-product-lightbox-open]');
    var lightboxClose = root.querySelector('[data-product-lightbox-close]');
    var finishCaption = root.querySelector('[data-finish-caption]');
    var metalLifestyle = root.querySelector('[data-metal-lifestyle]');
    var metalVisuals = Array.prototype.slice.call(root.querySelectorAll('[data-metal-visual]'));
    var metalOpeners = Array.prototype.slice.call(root.querySelectorAll('[data-metal-lifestyle-open]'));
    var metalLightbox = root.querySelector('[data-metal-lifestyle-lightbox]');
    var metalLightboxClose = root.querySelector('[data-metal-lifestyle-close]');
    var metalLightboxContent = root.querySelector('[data-metal-lifestyle-lightbox-content]');
    var metalLastOpener = null;
    var metalRoomVisual = root.querySelector('[data-metal-layout="room"]');
    var galleryWrapPreview = root.querySelector('[data-gallery-wrap-preview]');
    var galleryWrapVisuals = Array.prototype.slice.call(root.querySelectorAll('[data-gallery-wrap-visual]'));
    var galleryWrapOpeners = Array.prototype.slice.call(root.querySelectorAll('[data-gallery-wrap-open]'));
    var galleryWrapLightbox = root.querySelector('[data-gallery-wrap-lightbox]');
    var galleryWrapLightboxClose = root.querySelector('[data-gallery-wrap-close]');
    var galleryWrapLightboxContent = root.querySelector('[data-gallery-wrap-lightbox-content]');
    var galleryWrapLastOpener = null;
    var galleryWrapRoomVisual = root.querySelector('[data-gallery-wrap-layout="room"]');
    var framedPreview = root.querySelector('[data-framed-preview]');
    var framedVisuals = Array.prototype.slice.call(root.querySelectorAll('[data-framed-visual]'));
    var framedOpeners = Array.prototype.slice.call(root.querySelectorAll('[data-framed-preview-open]'));
    var framedLightbox = root.querySelector('[data-framed-preview-lightbox]');
    var framedLightboxClose = root.querySelector('[data-framed-preview-close]');
    var framedLightboxContent = root.querySelector('[data-framed-preview-lightbox-content]');
    var framedLastOpener = null;
    var framedRoomVisual = root.querySelector('[data-framed-layout="room"]');
    var finishOpt = (root.dataset.finishOption || 'finish').toLowerCase();
    var frameOpt = (root.dataset.frameOption || 'frame').toLowerCase();
    var matOpt = (root.dataset.matOption || 'mat').toLowerCase();
    var groups = Array.prototype.slice.call(root.querySelectorAll('[data-option-index]'));
    if (finishCaption) finishCaption.dataset.defaultCaption = finishCaption.textContent;

    function syncLightboxImage() {
      if (!mainImg || !lightboxImg || !lightboxPreview) return;
      lightboxImg.src = mainImg.currentSrc || mainImg.src;
      lightboxImg.alt = mainImg.alt;
      var stagePreview = mainImg.closest('.frame-preview');
      lightboxPreview.className = 'frame-preview product-lightbox__preview';
      lightboxPreview.removeAttribute('style');
      if (!stagePreview) return;
      ['is-framed', 'has-mat', 'is-canvas', 'is-metal'].forEach(function (className) {
        lightboxPreview.classList.toggle(className, stagePreview.classList.contains(className));
      });
      lightboxPreview.style.cssText = stagePreview.style.cssText;
    }

    if (lightbox && lightboxOpen && lightboxClose) {
      lightboxOpen.addEventListener('click', function () {
        syncLightboxImage();
        lightbox.showModal();
      });
      lightboxClose.addEventListener('click', function () { lightbox.close(); });
      lightbox.addEventListener('click', function (event) {
        if (event.target === lightbox || event.target.classList.contains('product-lightbox__image-wrap')) lightbox.close();
      });
      lightbox.addEventListener('close', function () { lightboxOpen.focus(); });
    }

    function projectMetalVisual(visual) {
      if (!visual) return;
      var panel = visual.querySelector('.metal-lifestyle__panel');
      if (!panel) return;
      var isPortrait = visual.dataset.metalOrientation === 'portrait';
      var isEdge = visual.dataset.metalLayout === 'edge';
      var points;
      if (isEdge && isPortrait) points = [[0.238, 0.086], [0.762, 0.086], [0.946, 0.878], [0.055, 0.878]];
      else if (isEdge) points = [[0.108, 0.155], [0.895, 0.153], [0.964, 0.850], [0.036, 0.850]];
      else if (isPortrait) points = [[0.2886, 0.0893], [0.7036, 0.0304], [0.7036, 0.8625], [0.2886, 0.8170]];
      else points = [[0.1437, 0.1848], [0.8440, 0.1050], [0.8430, 0.7960], [0.1437, 0.7384]];
      var visualWidth = visual.clientWidth;
      var visualHeight = visual.clientHeight;
      var sourceWidth = panel.offsetWidth;
      var sourceHeight = panel.offsetHeight;
      if (!visualWidth || !visualHeight || !sourceWidth || !sourceHeight) return;

      var x0 = points[0][0] * visualWidth;
      var y0 = points[0][1] * visualHeight;
      var x1 = points[1][0] * visualWidth;
      var y1 = points[1][1] * visualHeight;
      var x2 = points[2][0] * visualWidth;
      var y2 = points[2][1] * visualHeight;
      var x3 = points[3][0] * visualWidth;
      var y3 = points[3][1] * visualHeight;
      var dx1 = x1 - x2;
      var dx2 = x3 - x2;
      var dx3 = x0 - x1 + x2 - x3;
      var dy1 = y1 - y2;
      var dy2 = y3 - y2;
      var dy3 = y0 - y1 + y2 - y3;
      var denominator = dx1 * dy2 - dx2 * dy1;
      if (!denominator) return;
      var g = (dx3 * dy2 - dx2 * dy3) / denominator;
      var h = (dx1 * dy3 - dx3 * dy1) / denominator;
      var a = x1 - x0 + g * x1;
      var b = x3 - x0 + h * x3;
      var d = y1 - y0 + g * y1;
      var e = y3 - y0 + h * y3;
      panel.style.transform = 'matrix3d(' + [
        a / sourceWidth, d / sourceWidth, 0, g / sourceWidth,
        b / sourceHeight, e / sourceHeight, 0, h / sourceHeight,
        0, 0, 1, 0,
        x0, y0, 0, 1
      ].join(',') + ')';
    }

    function updateMetalRoomScale(values, variant) {
      if (!metalRoomVisual) return;
      var identity = values.filter(Boolean).join(' ') + ' ' + (variant && variant.title ? variant.title : '');
      var match = identity.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
      if (!match) return;
      var first = parseFloat(match[1]);
      var second = parseFloat(match[2]);
      var isPortrait = metalRoomVisual.dataset.metalOrientation === 'portrait';
      var displayedWidthInches = isPortrait ? Math.min(first, second) : Math.max(first, second);
      var couchWidthPercent = 71.4;
      metalRoomVisual.style.setProperty('--metal-room-art-width', ((displayedWidthInches / 72) * couchWidthPercent).toFixed(3) + '%');
    }

    function projectGalleryWrapVisual(visual) {
      if (!visual) return;
      var panel = visual.querySelector('.gallery-wrap__panel');
      if (!panel) return;
      var isPortrait = visual.dataset.galleryWrapOrientation === 'portrait';
      var isEdge = visual.dataset.galleryWrapLayout === 'edge';
      var points;
      if (isEdge && isPortrait) points = [[0.232, 0.083], [0.768, 0.083], [0.954, 0.846], [0.045, 0.846]];
      else if (isEdge) points = [[0.104, 0.155], [0.898, 0.152], [0.971, 0.820], [0.030, 0.820]];
      else if (isPortrait) points = [[0.2886, 0.0893], [0.7036, 0.0304], [0.7036, 0.8625], [0.2886, 0.8170]];
      // Slightly overscan the right front-face boundary to prevent the gray
      // canvas placeholder from forming a seam beside the black wrapped edge.
      else points = [[0.1429, 0.1848], [0.8457, 0.1089], [0.8386, 0.7920], [0.1429, 0.7393]];
      var visualWidth = visual.clientWidth;
      var visualHeight = visual.clientHeight;
      var sourceWidth = panel.offsetWidth;
      var sourceHeight = panel.offsetHeight;
      if (!visualWidth || !visualHeight || !sourceWidth || !sourceHeight) return;
      var x0 = points[0][0] * visualWidth, y0 = points[0][1] * visualHeight;
      var x1 = points[1][0] * visualWidth, y1 = points[1][1] * visualHeight;
      var x2 = points[2][0] * visualWidth, y2 = points[2][1] * visualHeight;
      var x3 = points[3][0] * visualWidth, y3 = points[3][1] * visualHeight;
      var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
      var dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
      var denominator = dx1 * dy2 - dx2 * dy1;
      if (!denominator) return;
      var g = (dx3 * dy2 - dx2 * dy3) / denominator;
      var h = (dx1 * dy3 - dx3 * dy1) / denominator;
      var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3;
      var d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
      panel.style.transform = 'matrix3d(' + [
        a / sourceWidth, d / sourceWidth, 0, g / sourceWidth,
        b / sourceHeight, e / sourceHeight, 0, h / sourceHeight,
        0, 0, 1, 0, x0, y0, 0, 1
      ].join(',') + ')';
    }

    function updateGalleryWrapRoomScale(values, variant) {
      if (!galleryWrapRoomVisual) return;
      var identity = values.filter(Boolean).join(' ') + ' ' + (variant && variant.title ? variant.title : '');
      var match = identity.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
      if (!match) return;
      var first = parseFloat(match[1]);
      var second = parseFloat(match[2]);
      var isPortrait = galleryWrapRoomVisual.dataset.galleryWrapOrientation === 'portrait';
      var displayedWidthInches = isPortrait ? Math.min(first, second) : Math.max(first, second);
      galleryWrapRoomVisual.style.setProperty('--gallery-room-art-width', ((displayedWidthInches / 72) * 71.4).toFixed(3) + '%');
    }

    function projectFramedVisual(visual) {
      if (!visual) return;
      var panel = visual.querySelector('.framed-preview__art-panel');
      if (!panel) return;
      var isPortrait = visual.dataset.framedOrientation === 'portrait';
      var isEdge = visual.dataset.framedLayout === 'edge';
      if (!isPortrait && !isEdge) {
        panel.style.left = '20.5%';
        panel.style.top = '21.8%';
        panel.style.width = '56.7%';
        panel.style.height = '46.3%';
        panel.style.aspectRatio = 'auto';
        panel.style.transform = 'none';
        panel.style.clipPath = 'polygon(0% 10.4%, 99.8% 0%, 100% 100%, 0.4% 95.9%)';
        return;
      }
      if (!isPortrait && isEdge) {
        panel.style.left = '12.5%';
        panel.style.top = '23.1%';
        panel.style.width = '75.2%';
        panel.style.height = '49.8%';
        panel.style.aspectRatio = 'auto';
        panel.style.transform = 'none';
        panel.style.clipPath = 'polygon(5.7% 0.6%, 94.4% 0.4%, 100% 100%, 0.1% 99.4%)';
        return;
      }
      var points;
      if (isEdge && isPortrait) points = [[0.291, 0.160], [0.710, 0.160], [0.801, 0.735], [0.198, 0.735]];
      else if (isEdge) points = [[0.168, 0.234], [0.828, 0.233], [0.857, 0.730], [0.127, 0.727]];
      else if (isPortrait) points = [[0.334, 0.153], [0.655, 0.120], [0.655, 0.771], [0.335, 0.751]];
      else points = [[0.205, 0.266], [0.771, 0.218], [0.772, 0.681], [0.207, 0.662]];
      var visualWidth = visual.clientWidth;
      var visualHeight = visual.clientHeight;
      var sourceWidth = panel.offsetWidth;
      var sourceHeight = panel.offsetHeight;
      if (!visualWidth || !visualHeight || !sourceWidth || !sourceHeight) return;
      var x0 = points[0][0] * visualWidth, y0 = points[0][1] * visualHeight;
      var x1 = points[1][0] * visualWidth, y1 = points[1][1] * visualHeight;
      var x2 = points[2][0] * visualWidth, y2 = points[2][1] * visualHeight;
      var x3 = points[3][0] * visualWidth, y3 = points[3][1] * visualHeight;
      var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
      var dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
      var denominator = dx1 * dy2 - dx2 * dy1;
      if (!denominator) return;
      var g = (dx3 * dy2 - dx2 * dy3) / denominator;
      var h = (dx1 * dy3 - dx3 * dy1) / denominator;
      var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3;
      var d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
      panel.style.transform = 'matrix3d(' + [
        a / sourceWidth, d / sourceWidth, 0, g / sourceWidth,
        b / sourceHeight, e / sourceHeight, 0, h / sourceHeight,
        0, 0, 1, 0, x0, y0, 0, 1
      ].join(',') + ')';
    }

    function framedSize(values, variant) {
      var identity = values.filter(Boolean).join(' ') + ' ' + (variant && variant.title ? variant.title : '');
      var match = identity.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
      if (!match) return null;
      return { first: parseFloat(match[1]), second: parseFloat(match[2]) };
    }

    function framedMatInches(values, variant) {
      var size = framedSize(values, variant);
      if (!size) return 2;
      var shortSide = Math.min(size.first, size.second);
      var longSide = Math.max(size.first, size.second);
      return shortSide === 12 && longSide === 18 ? 1.5 : 2;
    }

    function updateFramedRoomScale(values, variant) {
      if (!framedRoomVisual) return;
      var size = framedSize(values, variant);
      if (!size) return;
      var isPortrait = framedRoomVisual.dataset.framedOrientation === 'portrait';
      var printWidth = isPortrait ? Math.min(size.first, size.second) : Math.max(size.first, size.second);
      var printHeight = isPortrait ? Math.max(size.first, size.second) : Math.min(size.first, size.second);
      var frameAddition = 1.125;
      var finishedWidth = printWidth + frameAddition;
      var finishedHeight = printHeight + frameAddition;
      var matWidth = framedMatInches(values, variant);
      framedRoomVisual.style.setProperty('--framed-room-art-width', ((finishedWidth / 72) * 71.4).toFixed(3) + '%');
      framedRoomVisual.style.setProperty('--framed-room-aspect', (finishedWidth / finishedHeight).toFixed(4));
      framedRoomVisual.style.setProperty('--framed-room-mat-width', ((matWidth / finishedWidth) * 100).toFixed(3) + '%');
    }

    if (metalOpeners.length && metalLightbox && metalLightboxClose && metalLightboxContent) {
      metalOpeners.forEach(function (metalOpen) {
        metalOpen.addEventListener('click', function () {
          var sourceVisual = metalOpen.querySelector('[data-metal-visual]');
          metalLastOpener = metalOpen;
          metalLightboxContent.replaceChildren();
          var enlargedVisual = sourceVisual.cloneNode(true);
          metalLightboxContent.appendChild(enlargedVisual);
          metalLightbox.showModal();
          requestAnimationFrame(function () { projectMetalVisual(enlargedVisual); });
        });
      });
      metalLightboxClose.addEventListener('click', function () { metalLightbox.close(); });
      metalLightbox.addEventListener('click', function (event) {
        if (event.target === metalLightbox || event.target === metalLightboxContent) metalLightbox.close();
      });
      metalLightbox.addEventListener('close', function () {
        metalLightboxContent.replaceChildren();
        if (metalLastOpener) metalLastOpener.focus();
      });
    }

    if (galleryWrapOpeners.length && galleryWrapLightbox && galleryWrapLightboxClose && galleryWrapLightboxContent) {
      galleryWrapOpeners.forEach(function (opener) {
        opener.addEventListener('click', function () {
          var sourceVisual = opener.querySelector('[data-gallery-wrap-visual]');
          galleryWrapLastOpener = opener;
          galleryWrapLightboxContent.replaceChildren();
          var enlargedVisual = sourceVisual.cloneNode(true);
          galleryWrapLightboxContent.appendChild(enlargedVisual);
          galleryWrapLightbox.showModal();
          requestAnimationFrame(function () { projectGalleryWrapVisual(enlargedVisual); });
        });
      });
      galleryWrapLightboxClose.addEventListener('click', function () { galleryWrapLightbox.close(); });
      galleryWrapLightbox.addEventListener('click', function (event) {
        if (event.target === galleryWrapLightbox || event.target === galleryWrapLightboxContent) galleryWrapLightbox.close();
      });
      galleryWrapLightbox.addEventListener('close', function () {
        galleryWrapLightboxContent.replaceChildren();
        if (galleryWrapLastOpener) galleryWrapLastOpener.focus();
      });
    }

    if (framedOpeners.length && framedLightbox && framedLightboxClose && framedLightboxContent) {
      framedOpeners.forEach(function (opener) {
        opener.addEventListener('click', function () {
          var sourceVisual = opener.querySelector('[data-framed-visual]');
          framedLastOpener = opener;
          framedLightboxContent.replaceChildren();
          var enlargedVisual = sourceVisual.cloneNode(true);
          framedLightboxContent.appendChild(enlargedVisual);
          framedLightbox.showModal();
          requestAnimationFrame(function () { projectFramedVisual(enlargedVisual); });
        });
      });
      framedLightboxClose.addEventListener('click', function () { framedLightbox.close(); });
      framedLightbox.addEventListener('click', function (event) {
        if (event.target === framedLightbox || event.target === framedLightboxContent) framedLightbox.close();
      });
      framedLightbox.addEventListener('close', function () {
        framedLightboxContent.replaceChildren();
        if (framedLastOpener) framedLastOpener.focus();
      });
    }

    window.addEventListener('resize', function () {
      if (metalLifestyle && !metalLifestyle.hidden) requestAnimationFrame(function () {
        metalVisuals.forEach(projectMetalVisual);
      });
      if (metalLightbox && metalLightbox.open) {
        requestAnimationFrame(function () { projectMetalVisual(metalLightboxContent.querySelector('[data-metal-visual]')); });
      }
      if (galleryWrapPreview && !galleryWrapPreview.hidden) requestAnimationFrame(function () {
        galleryWrapVisuals.forEach(projectGalleryWrapVisual);
      });
      if (galleryWrapLightbox && galleryWrapLightbox.open) {
        requestAnimationFrame(function () { projectGalleryWrapVisual(galleryWrapLightboxContent.querySelector('[data-gallery-wrap-visual]')); });
      }
      if (framedPreview && !framedPreview.hidden) requestAnimationFrame(function () {
        framedVisuals.forEach(projectFramedVisual);
      });
      if (framedLightbox && framedLightbox.open) {
        requestAnimationFrame(function () { projectFramedVisual(framedLightboxContent.querySelector('[data-framed-visual]')); });
      }
    });

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

      function finishCaption(value) {
        var lower = (value || '').toLowerCase();
        if (/gallery\s*wrap|canvas/.test(lower)) return 'Texture & depth';
        if (/metal|aluminum|aluminium/.test(lower)) return 'Clean & luminous';
        if (/frame|matted/.test(lower)) return 'A timeless finish';
        if (/paper|print/.test(lower)) return 'Archival & classic';
        return '';
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
          if (name === 'finish') {
            var caption = finishCaption(value);
            if (caption) {
              var small = document.createElement('small');
              small.textContent = caption;
              content.appendChild(small);
            }
          }
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

    function hasRenderedFrame(variant) {
      var image = variant && variant.featured_image;
      if (!image) return false;
      var identity = [image.alt, image.src, image.url].filter(Boolean).join(' ');
      return /FinerWorks Alto Black Thin frame|finerworks-framed|WHCC Gallery Slim black frame|whcc-gallery-slim-double-white-(?:1-5|2)/i.test(identity);
    }

    function updateFrame(values, variant) {
      var frameColor = null, matColor = null, hasFrameOption = false, hasMatOption = false, finishValue = '';
      groups.forEach(function (g, i) {
        var name = (g.dataset.optionName || '').toLowerCase();
        var kind = (g.dataset.optionKind || '').toLowerCase();
        if (kind === 'finish' || name.indexOf(finishOpt) !== -1) finishValue = (values[i] || '').toLowerCase();
        else if (name.indexOf(frameOpt) !== -1) { hasFrameOption = true; frameColor = lookup(FRAME_COLORS, values[i]); }
        else if (name.indexOf(matOpt) !== -1) { hasMatOption = true; matColor = lookup(MAT_COLORS, values[i]); }
      });
      var isCanvas = /canvas|gallery\s*wrap/.test(finishValue);
      var isMetal = /metal|aluminum|aluminium/.test(finishValue);
      var isFramedFinish = /frame|matted/.test(finishValue);
      var usesRenderedFrame = isFramedFinish && hasRenderedFrame(variant);
      var matInches = framedMatInches(values, variant);
      updateMetalRoomScale(values, variant);
      updateGalleryWrapRoomScale(values, variant);
      updateFramedRoomScale(values, variant);
      if (metalLifestyle) {
        metalLifestyle.hidden = !isMetal;
        metalLifestyle.setAttribute('aria-hidden', isMetal ? 'false' : 'true');
        if (isMetal) requestAnimationFrame(function () { metalVisuals.forEach(projectMetalVisual); });
      }
      if (galleryWrapPreview) {
        galleryWrapPreview.hidden = !isCanvas;
        galleryWrapPreview.setAttribute('aria-hidden', isCanvas ? 'false' : 'true');
        if (isCanvas) requestAnimationFrame(function () { galleryWrapVisuals.forEach(projectGalleryWrapVisual); });
      }
      if (framedPreview) {
        framedPreview.hidden = !isFramedFinish;
        framedPreview.setAttribute('aria-hidden', isFramedFinish ? 'false' : 'true');
        if (isFramedFinish) requestAnimationFrame(function () { framedVisuals.forEach(projectFramedVisual); });
      }
      if (!frame) return;
      if (isCanvas || isMetal) {
        frameColor = null;
        matColor = null;
      } else if (usesRenderedFrame) {
        frameColor = null;
        matColor = null;
      } else if (isFramedFinish) {
        if (!hasFrameOption) frameColor = '#252522';
        if (!hasMatOption) matColor = '#ffffff';
      }
      frame.classList.toggle('is-canvas', isCanvas);
      frame.classList.toggle('is-metal', isMetal);
      frame.classList.toggle('is-framed', !!frameColor);
      frame.classList.toggle('has-mat', !!matColor);
      frame.classList.toggle('mat-1-5', isFramedFinish && matInches === 1.5);
      frame.classList.toggle('mat-2', isFramedFinish && matInches === 2);
      frame.style.setProperty('--frame-color', frameColor || 'transparent');
      frame.style.setProperty('--mat-color', matColor || 'transparent');
      if (finishCaption) {
        if (isCanvas) finishCaption.textContent = 'Gallery wrap · Texture and depth preview';
        else if (isMetal) finishCaption.textContent = 'Metal · Clean and luminous preview';
        else if (isFramedFinish) finishCaption.textContent = 'Matted and framed · ' + matInches + '-inch double-white mat preview';
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
      var variant = findVariant(values);
      updateFrame(values, variant);
      updateAvailability(values);
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
      if (mainImg) {
        var variantImage = variant.featured_image;
        var nextImageSrc = variantImage ? (variantImage.src || variantImage.url) : baseImageSrc;
        if (nextImageSrc) mainImg.src = nextImageSrc;
        mainImg.alt = variantImage && variantImage.alt ? variantImage.alt : baseImageAlt;
        mainImg.removeAttribute('srcset');
      }
      var url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    }

    groups.forEach(function (g) { g.addEventListener('change', update); });
    initWhccPicker();

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

  function initJournalCarousel(root) {
    if (root.dataset.journalReady) return;
    root.dataset.journalReady = '1';
    var track = root.querySelector('[data-journal-track]');
    var prev = root.querySelector('[data-journal-prev]');
    var next = root.querySelector('[data-journal-next]');
    if (!track || !prev || !next) return;
    var cards = Array.prototype.slice.call(track.querySelectorAll('.journal-card'));

    if (cards.length < 2) {
      prev.hidden = true;
      next.hidden = true;
      return;
    }

    function stepWidth() {
      var styles = window.getComputedStyle(track);
      var gap = parseFloat(styles.columnGap || styles.gap) || 0;
      return cards[0].getBoundingClientRect().width + gap;
    }

    prev.addEventListener('click', function () {
      var max = Math.max(0, track.scrollWidth - track.clientWidth);
      if (track.scrollLeft <= 2) track.scrollTo({ left: max, behavior: 'smooth' });
      else track.scrollBy({ left: -stepWidth(), behavior: 'smooth' });
    });
    next.addEventListener('click', function () {
      var max = Math.max(0, track.scrollWidth - track.clientWidth);
      if (track.scrollLeft >= max - 2) track.scrollTo({ left: 0, behavior: 'smooth' });
      else track.scrollBy({ left: stepWidth(), behavior: 'smooth' });
    });
  }

  function initAll() {
    document.querySelectorAll('[data-product]').forEach(initProduct);
    document.querySelectorAll('[data-slideshow]').forEach(initSlideshow);
    document.querySelectorAll('[data-journal-carousel]').forEach(initJournalCarousel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
  // Re-initialise when sections are edited in the Shopify theme editor
  document.addEventListener('shopify:section:load', initAll);
})();
