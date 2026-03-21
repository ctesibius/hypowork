#!/usr/bin/env node
/**
 * Run Vite without Console Ninja's patch to `node_modules/vite/bin/vite.js`.
 * The Cursor/VS Code extension injects a hook there; importing `dist/node/cli.js`
 * directly avoids it so the dev server starts normally and logs as expected.
 */
import "../node_modules/vite/dist/node/cli.js";
