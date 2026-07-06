# AWS Console Privacy Mask

A Chrome extension that replaces sensitive info in the AWS console with
asterisks (`*`) so you can share your screen without leaking account details.

I built this because I kept flashing my account ID and ARNs on calls and
recordings. Now they just show up as `*` and I don't have to think about it.

It works on demos, live streams, screen recordings, and pair debugging.

## What it hides

Some things get caught automatically with no setup at all:

- Account ID, both the raw `222634390360` and the dashed `2226-3439-0360` form
- Any ARN on any dashboard, like `arn:aws:cloudfront::...`, `arn:aws:s3:::...`,
  or IAM ARNs

A couple of things can't be guessed from a pattern because they're just
arbitrary text: your account name (like `my-account-name`) and your federated
user, IAM user, or assumed role (like `Admin/my-role`). For those, the
extension reads the value sitting next to AWS's own labels ("Account name",
"Federated user", and so on) in the account menu, remembers it, and hides it
everywhere else it shows up, including the account tab in the top nav. Open the
account menu once and it figures the rest out.

If something slips through, there's an Advanced box in the popup where you can
type extra terms to hide.

## How it works

A content script walks the text on the page and swaps sensitive values for `*`.
It keeps the dashes in account IDs so the shape still looks familiar. A
MutationObserver re-runs the masking whenever the console re-renders or you jump
to a different dashboard, since the console is a single page app.

The original text is kept in memory per node, so flipping the extension off puts
everything back right away. Nothing leaves your browser.

## Install from source

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome.
3. Turn on Developer mode in the top right.
4. Click Load unpacked and pick the `aws-console-privacy` folder.
5. Open the AWS console and click your account menu once so it can learn your
   account name and federated user. After that, the sensitive bits show as `*`.

## Usage

Click the extension icon to open the popup. The top switch turns the whole thing
on or off. The checkboxes let you decide what gets masked (account ID, ARNs,
auto-detect). The Advanced section is only there for the rare thing that isn't
caught on its own.

## Privacy

Nothing is collected or sent anywhere. All the masking happens locally in your
browser. Your settings are saved with Chrome's `storage.sync` so they follow
your profile.

## Limitations

Auto-detection leans on AWS's label text. If AWS renames a label, that value
won't get learned until you reopen the account menu, and in the worst case you
can drop it into the Advanced box. The pattern matching for account IDs and ARNs
doesn't depend on labels, so that part always works.

Also worth saying: this is a visual mask only. The real values still exist in
the page's underlying data and in network responses. It's meant for screen
sharing, not as a security boundary.

## License

MIT. See [LICENSE](LICENSE).
