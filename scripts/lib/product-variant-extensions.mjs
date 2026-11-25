export const GALLERY_WRAP_40X60 = Object.freeze({
  finish: 'Gallery Wrap',
  size: '40x60',
  price: '1500.00',
  whccProductRef: 'gallery-wrap',
  whccSelections: Object.freeze({
    size: '40x60',
    canvas_type: 'premium_fine_art',
    depth: '2_1_2in',
    protection: 'semi_gloss',
    gallery_wrap_edge: 'black_edge',
    all_hanging_hardware: 'sawtooth_hangers_bumpers_paper_backing',
  }),
});

export const PRODUCT_VARIANT_EXTENSIONS = Object.freeze({
  'aspen-icm': Object.freeze([GALLERY_WRAP_40X60]),
  'the-geometry-of-light': Object.freeze([GALLERY_WRAP_40X60]),
});

export function variantsForProduct(baseVariants, handle) {
  return [...baseVariants, ...(PRODUCT_VARIANT_EXTENSIONS[handle] || [])];
}
