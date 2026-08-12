# Stylized Avatar Demo Asset

`stylized-avatar-v1-small.png` is an original generated effect image for the
competition H5 prototype. It demonstrates the intended visual bar for the
identity-driven comic avatar result and does not claim to be the output of the
current local runtime.

The UI labels it as an AIGC effect preview. A production provider must replace
this asset with a generated result based on the user's identity photo and
selected product images.

## Offline action × scene previews

The `scenes/` directory contains three original, project-specific effect
previews generated in an isolated local AIGC runtime from the same character
reference:

- `confident-rooftop-v1.png` — confident cover pose on a city rooftop.
- `street-gallery-v1.png` — mid-stride fashion pose inside an art gallery.
- `wave-storefront-v1.png` — open-hand greeting in a department-store window.

These files are static competition assets. The public H5 does not send identity
photos or generation requests to the AIGC machine, an Avatar API, a Worker, or
a public tunnel. Character, garment, and store fidelity remain effect-preview
boundaries rather than claims of real-time production generation.
