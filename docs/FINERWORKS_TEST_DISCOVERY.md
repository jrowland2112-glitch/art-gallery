# FinerWorks Test discovery

This branch adds read-only FinerWorks catalog discovery and product-code validation. It does not connect Shopify webhooks, alter products, submit an order, or enable fulfillment.

## Credential handling

FinerWorks requires both `web_api_key` and `app_key`. The app key used here must remain in FinerWorks Test mode.

Run:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\run-finerworks-doctor.ps1
```

The first run prompts for both values and saves Windows DPAPI-encrypted values under `%LOCALAPPDATA%\RowlandPhotography\Secrets`. The encrypted files are tied to the current Windows account and live outside the repository. Later runs decrypt them only in the PowerShell process, pass them to the requested Node command, and clear the plain-text process variables afterward.

The credentials must never be pasted into chat, written to this repository, committed, or stored as permanent plain-text environment variables. A later deployed Worker must use separate Cloudflare encrypted secrets.

## Catalog discovery

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\run-finerworks-doctor.ps1
```

This calls only credential-test and catalog-list endpoints. It writes a non-secret snapshot to `.bulk-upload/finerworks-test-catalog.json`, which Git ignores.

The November 14, 2026 Test catalog confirmed:

- Alto Black - Thin: frame ID `96`, Gallery Contemporary, solid wood with veneer, matting and acrylic permitted.
- Snow White: mat ID `1`, white core.
- Premium Clear: glazing ID `1`, framing-grade clear acrylic.
- Moab Exhibition Luster 300 (Satin Luster Paper): product type `5`, media ID `7`.
- ChromaLuxe White Gloss: product type `14`, media ID `130`.
- Inset Metallic Float Hanger: mounting ID `68`.
- Artisan Archival Canvas: product type `1`, media ID `46`, satin/low-gloss appearance.
- 1.5-inch image wrap: mounting ID `29`.
- Basic canvas finishing: add-on ID `1`.

## Product-code validation

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\run-finerworks-doctor.ps1 -NpmScript finerworks:validate-mappings
```

This calls FinerWorks' product-code builder and pricing endpoints for the nine standard variants. It cannot submit an order. The non-secret result is written to `.bulk-upload/finerworks-mapping-validation.json`.

All nine codes in `bulk-upload/finerworks/mappings.json` were accepted and priced in Test on November 14, 2026. The returned wholesale totals before shipping were:

| Finish | 12x18 | 16x24 | 24x36 |
| --- | ---: | ---: | ---: |
| Framed | $154 | $227 | $409 |
| Metal | $88 | $141 | $289 |
| Gallery Wrap | $78 | $116 | $211 |

Prices are discovery evidence, not permanent pricing. The connector must retrieve current pricing and shipping before any submission and enforce a configurable maximum.

The approved wider framed configuration uses Snow White (mat ID `1`) for both layers. Each layer adds a 1.25-inch step per side, for 2.5 inches of visible mat per side. FinerWorks accepted these configured frame sizes:

| Print | Configured frame size |
| --- | --- |
| 12x18 | 17x23 |
| 16x24 | 21x29 |
| 24x36 | 29x41 |

These differ from the current WHCC storefront dimensions. Shopify copy must not change until Joseph approves FinerWorks after reviewing a physical sample.

## Remaining gates

1. Generate and review FinerWorks finish renders using the exact product codes.
2. Add a separate disabled Test connector and durable state; do not reuse the enabled path or database of another provider.
3. Validate current production and shipping prices against store margins.
4. Exercise only FinerWorks Test submissions first.
5. Order one explicitly approved, billable framed sample.
6. Inspect the physical print, frame, mats, acrylic, crop, packaging, and color.
7. Only after approval, update Shopify mappings, finish previews, dimensions, and fulfillment routing in separate reviewed changes.
