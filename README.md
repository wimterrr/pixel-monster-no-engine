# Pixel Monster Game Without An Engine

Compiler-first pixel monster RPG spike.

Current slice:

- One authored `Route01` map source
- One compiled route bundle consumed by runtime
- One encounter path with a guaranteed first capture
- One save/reload receipt for checkpoint, roster delta, and spent capture orb state
- One broken fixture that fails during compile

Commands:

```bash
npm run build:content
npm test
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

GitHub Pages build:

```bash
npm run build:pages
npm run serve:docs
```
