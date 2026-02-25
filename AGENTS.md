# AGENTS.md

## Cursor Cloud specific instructions

This is a zero-dependency, static HTML5 Canvas + JavaScript game ("Quest of the Dragon's Gold"). There is no package manager, build system, linter, test framework, or backend service.

### Running the application

Serve the `game/` directory with any static HTTP server:

```
python3 -m http.server 8080 --directory game
```

Then open `http://localhost:8080/` in Chrome.

### Key caveats

- **No lint/test/build tooling**: The project has no `package.json`, no test suite, and no linter configured. Validation is manual (load in browser and interact).
- **All state is client-side**: Game uses `localStorage` for save/load. No database or API.
- **Canvas rendering**: The game renders on a 1200x700 HTML5 Canvas. UI overlays (inventory, quest log, combat, shops) are HTML elements positioned absolutely over the canvas.
- **Procedural generation**: The game world is seeded from `Date.now()`, so each playthrough generates a different map layout.
