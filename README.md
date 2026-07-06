# AWS Console Privacy Mask

A lightweight Chrome extension (Manifest V3) that masks sensitive AWS Management
Console information with asterisks (`*`) so you can safely share your screen.

Great for demos, live streams, screen recordings, and pair-debugging where you
don't want to leak account details.

## What it hides

**Automatically, no configuration:**

- **Account ID** — both the raw `222634390360` and dashed `2226-3439-0360` forms
- **ARNs** — any `arn:aws:...` string on any dashboard (e.g. CloudFront, S3, IAM)

**Automatically, via label self-learning:**

- **Account name** (e.g. `my-account-name`)
- **Federated user / IAM user / assumed role** (e.g. `Admin/my-role`)

  These are arbitrary strings, so they can't be matched by a pattern. Instead the
  extension reads the value shown next to AWS's fixed labels ("Account name",
  "Federated user", etc.) in the account menu, remembers it, and masks it
  everywhere it appears — including the top navigation account tab. Just open the
  account menu once so it can learn them.

**Manually (optional fallback):**

- Any extra term you enter in the popup's Advanced section.

## How it works

- A content script walks the page's text nodes and replaces sensitive values
  with `*`, preserving layout (dashes in account IDs are kept so the shape stays
  familiar).
- A `MutationObserver` re-applies masking as the console re-renders and when you
  switch dashboards (it's a single-page app).
- Original values are stashed per text node, so toggling the extension off
  restores them instantly. Nothing is sent anywhere — all processing is local.

## Install (from source)

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the `aws-console-privacy` folder.
5. Open the AWS console. Click your account menu once so the extension can learn
   your account name and federated user. Everything sensitive becomes `*`.

## Usage

- Click the extension icon to open the popup.
- Toggle the whole extension on/off with the top switch.
- Fine-tune what gets masked (account ID, ARNs, auto-detect) with the checkboxes.
- Use the **Advanced** section only if something isn't caught automatically.

## Privacy

This extension does not collect, transmit, or store any data remotely. All
masking happens in your browser. Settings are saved via Chrome's `storage.sync`
so they follow your Chrome profile.

## Limitations

- Auto-detection relies on AWS's label text. If AWS renames a label, that value
  won't be learned until you reopen the account menu; worst case, add it in the
  Advanced box. Pattern-based masking (account ID, ARNs) does not depend on
  labels and always works.
- Masking is visual only. It does not prevent the values from existing in the
  page's underlying data or network responses.

## License

MIT — see [LICENSE](LICENSE).
