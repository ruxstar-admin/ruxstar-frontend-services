// Generates app/tokens.css from design/tokens.json. `--check` fails when the CSS is stale.
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const tokens = JSON.parse(await readFile(new URL("design/tokens.json", root), "utf8"));
const out = new URL("app/tokens.css", root);

const px = (n) => (n === 0 ? "0" : `${n}px`);
const colors = Object.entries(tokens.color)
  .filter(([name]) => name !== "about")
  .map(([name, value]) => `  --${name}: ${value};`)
  .join("\n");

const fixed = [
  `  --logo-yellow: ${tokens.logo.yellow};`,
  `  --logo-blue: ${tokens.logo.blue};`,
  `  --font: var(--font-sans), ${tokens.font.body.fallback};`,
  ...Object.entries(tokens.type).flatMap(([name, t]) => [
    `  --type-${name}: ${t.weight} ${px(t.size)}/${px(t.line)} var(--font);`,
    `  --type-${name}-tracking: ${t.tracking ? `${t.tracking}em` : "0"};`,
  ]),
  ...Object.entries(tokens.space).map(([k, v]) => `  --space-${k}: ${px(v)};`),
  ...Object.entries(tokens.radius).map(([k, v]) => `  --radius-${k}: ${px(v)};`),
  ...Object.entries(tokens.size).map(([k, v]) => `  --size-${k}: ${k === "icon-stroke" ? v : px(v)};`),
  ...Object.entries(tokens.motion.duration).map(([k, v]) => `  --dur-${k}: ${v}ms;`),
  ...Object.entries(tokens.motion.easing).map(([k, v]) => `  --ease-${k}: cubic-bezier(${v.join(", ")});`),
  `  --press-scale: ${tokens.motion["press-scale"]};`,
].join("\n");

const typeClasses = Object.keys(tokens.type)
  .map((name) => `.t-${name} {\n  font: var(--type-${name});\n  letter-spacing: var(--type-${name}-tracking);\n}`)
  .join("\n\n");

const css = `/* Generated from design/tokens.json by \`npm run tokens\`. Do not edit. */

:root {
  color-scheme: dark;
${colors}
${fixed}
}

${typeClasses}
`;

if (process.argv.includes("--check")) {
  const current = (await readFile(out, "utf8").catch(() => "")).replace(/\r\n/g, "\n");
  if (current !== css) {
    console.error("app/tokens.css is out of date. Run `npm run tokens`.");
    process.exit(1);
  }
  console.log("app/tokens.css is up to date.");
} else {
  await writeFile(out, css);
  console.log("Wrote app/tokens.css");
}
