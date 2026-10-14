import esbuild from "esbuild";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  // jsPDF 의 html() · SVG 기능용 선택 모듈은 쓰지 않으므로 묶지 않는다 (번들 크기)
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", "canvg", "dompurify", ...builtins],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  jsx: "automatic",
  jsxImportSource: "preact",
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
