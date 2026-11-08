# Draft product creator

This tool turns photographs into Shopify **Draft** products. It cannot activate or publish a product. It does not submit WHCC orders; that connector remains a later, separately approved phase.

## Safety promises

- Dry run is the default. Only `npm run photos:upload` writes.
- Every Shopify write explicitly sets product status to `DRAFT`.
- An existing Active or Archived product is never modified.
- A stable handle makes reruns update the same Draft instead of creating duplicates.
- API credentials are read from local environment variables and never printed.
- Full-resolution originals stay private. Shopify receives a maximum-3000-pixel sRGB JPEG.
- Without private object storage, uploads stop unless `--allow-local-original` is explicitly supplied. Such a Draft is marked by a warning and is not ready for automated fulfillment.

## One-time setup

Joseph creates the accounts and credentials. Do not paste any secret into chat and do not save one in this repository.

1. Create/install a Shopify app for Joseph's store with `read_products` and `write_products` access.
2. Store its client ID and client secret in the local user environment as `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`.
3. Store `rowland-photography-0v8ydig1.myshopify.com` as `SHOPIFY_STORE` (optional because this store is the safe default).
4. For durable originals, create a private S3-compatible bucket such as Cloudflare R2 and store these local environment variables:
   - `ORIGINALS_S3_ENDPOINT`
   - `ORIGINALS_S3_REGION` (`auto` for R2)
   - `ORIGINALS_S3_BUCKET`
   - `ORIGINALS_S3_ACCESS_KEY_ID`
   - `ORIGINALS_S3_SECRET_ACCESS_KEY`
5. Install the tool once with `npm install`.

PowerShell user-level environment variables can be entered locally without exposing their values in the command history by using a secure prompt:

```powershell
$secret = Read-Host "Enter the value" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  [Environment]::SetEnvironmentVariable("VARIABLE_NAME", [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer), "User")
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
```

Replace only `VARIABLE_NAME`, not the secret in the command. Open a new terminal after setting user variables.

## Mountain Light: copy the current Glade Creek prices

First perform the read-only check:

```powershell
npm run photos:check -- --image "E:\SHots\Mountain Light.jpg" --title "Mountain Light" --copy-from "glade-creek-grist-mill"
```

Then create the Draft. If private storage has not been configured yet, the explicit local-original switch is acceptable for visual review, but the product is not ready for automated WHCC fulfillment:

```powershell
npm run photos:upload -- --image "E:\SHots\Mountain Light.jpg" --title "Mountain Light" --copy-from "glade-creek-grist-mill" --allow-local-original
```

The tool reads the live product's variant prices. It understands both proper `Finish`/`Size` options and the existing combined `Title` values such as `Framed 12x18 Black`.

## Folder plus price sheet

Copy `bulk-upload/prices.example.csv` outside the repository or rename it for real use. Every enabled row becomes a Finish/Size variant for every photograph:

```powershell
npm run photos:check -- --folder "E:\Print Uploads" --prices "E:\Print Uploads\prices.csv"
npm run photos:upload -- --folder "E:\Print Uploads" --prices "E:\Print Uploads\prices.csv"
```

An optional `photos.csv` provides titles, alt text, tags, and descriptions. Without it, the filename becomes the title.

WHCC selection JSON contains catalog choices, not secrets. The example files are placeholders; real IDs must come from the Test catalog before they are used for automatic fulfillment.

## What a successful run reports

For every photograph, the dry run shows:

- source dimensions and format;
- optimized storefront-image dimensions and size;
- product title and handle;
- every Finish/Size price;
- whether the next action is dry-run only or a Draft write.

The write command ends by confirming the number of Draft products and explicitly stating that none were activated or published.
