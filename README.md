# Classes and Events

Solutions to the SoftUni exercise **"Classes and Events"** from the course *Fundamentals of Programming with AI*. Everything is plain JavaScript (ES6 classes), HTML and CSS: no frameworks and no build step.

## Live demo

| Page | Link |
|---|---|
| Colorful figures (canvas + table) | https://classes-and-events-h8uxj1.netlify.app/figures.html |
| Text sizes (event handlers) | https://classes-and-events-h8uxj1.netlify.app/sizes.html |

The site root, https://classes-and-events-h8uxj1.netlify.app, opens the figures page.

## What's inside

```
classes-and-events/
  figures.js     class hierarchy + console demo (runs in Node and in the browser)
  figures.html   draws colorful figures on a <canvas> and lists them in a table
  sizes.html     two number inputs + a button that prints "Size N" lines
  styles.css     shared light theme for both pages
  _redirects     Netlify rule: "/" serves figures.html
```

### Part 1: Class hierarchy (`figures.js`)

- `Color(red, green, blue)`: validates integers 0–255; `toString()` returns `#RRGGBB`, for example `new Color(255, 122, 30)` gives `#FF7A1E`.
- `Figure` (abstract): `x`, `y`, `move(dX, dY)`, `resetPosition()`, and abstract `area()` / `perimeter()`. Calling `new Figure(...)` throws (`new.target` check).
- `ColorfulFigure` (abstract): extends `Figure` and adds `color`.
- `Square`, `Rectangle`, `Circle`, `Annulus`, plus colorful versions of each.

Each formula is defined once, in a shared `Geometry` helper object, and both the plain and colorful classes call it. `toString()` is also defined once in `Figure`: each subclass supplies only its name and size text, and `ColorfulFigure` adds `color = #RRGGBB`.

```
Square({10, 35}, width = 10, color = #FF7A1E)
Rectangle({-10, 20}, size = 20 x 15, color = #7FAAE8)
Circle({20, -10}, radius = 15, color = #00EE00)
Annulus({20, -10}, ext. radius = 15, int. radius = 5, color = #EE3333)
```

### Part 2: Visualization (`figures.html`)

Loads `figures.js`, creates six colorful figures and draws them on a canvas. The origin is in the center, y points up, and 1 unit = 5 px. The annulus is drawn as a real ring: an outer circle and an inner circle filled with the even-odd rule. Below the drawing, a table shows each figure's `toString()`, area and perimeter.

### Part 3: Event handlers (`sizes.html`)

A **Print text** button with an `onclick` handler reads *Start size* and *End size*. If `0 < start < end < 100` is false, it shows **Invalid range**. Otherwise it prints one `<div style="font-size: Npt">Size N</div>` for every size in the range. The elements are built with `document.createElement`, and the output is cleared on every click.

## How the website was made

1. **Prompt.** The exercise was turned into a detailed prompt: the required classes, their exact `toString()` formats, the HTML pages and the styling rules. It also listed two traps in the original assignment text: a Cyrillic "а" hidden in `rаdius` and the invalid CSS `font-size=5pt`.
2. **AI-assisted coding.** The code was written with [Claude Code](https://claude.com/claude-code) in VS Code, working from that prompt.
3. **Testing the classes.** `node figures.js` runs the demo and prints every figure with its area and perimeter. It also shows `move()` / `resetPosition()` and checks that the abstract classes and invalid values throw errors. The source was checked for non-Latin characters.
4. **The pages.** `figures.html` and `sizes.html` reuse the same `figures.js` file: at the end it exports the classes with `module.exports` only when `module` exists. Both pages share `styles.css`: a light theme with one accent color, a centered card layout, and a mobile layout.
5. **Deploying.** The `classes-and-events` folder was deployed to Netlify with the Netlify CLI. It has no build step; the files are uploaded as they are:

   ```bash
   cd classes-and-events
   npx netlify-cli deploy --dir=. --prod --no-build
   ```

   New Netlify sites can start with **team login** protection on, which makes them return 401 to the public. It was switched off in *Project configuration → Visitor access* so anyone can open the links above.

## Run locally

```bash
cd classes-and-events
node figures.js          # Part 1: prints the demo to the console
```

For Parts 2 and 3, open `figures.html` or `sizes.html` with the VS Code **Live Server** extension, or just open them in a browser.
