const fs = require('node:fs');
const path = require('node:path');

// The website and this app compile the same DESIGN.md at the project root
// with the same compiler: complete CSS colors, as Uniwind theme variants here.
module.exports = async function prepareDesign(app, { watch = true } = {}) {
  const { compileNativeDesignCss, defaultDesignDocument, parseDesignDocument } = await import('./spk-design-compiler.mjs');
  let root = app;
  for (let dir = app; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'builder/project-manifest.json'))) { root = dir; break; }
    if (path.dirname(dir) === dir) break;
  }
  const document = path.join(root, 'DESIGN.md');
  const write = (file, text) => {
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return;
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, text);
    fs.renameSync(temporary, file);
  };
  function compile() {
    const design = fs.existsSync(document) ? parseDesignDocument(fs.readFileSync(document, 'utf8')) : defaultDesignDocument();
    write(path.join(app, 'lib/spk-design-theme.ts'), 'export default ' + JSON.stringify({ defaultTheme: design.defaultTheme, themes: Object.keys(design.themes) }) + ' as const;\n');
    write(path.join(app, 'spk-design.css'), compileNativeDesignCss(design));
  }
  compile();
  if (!watch) return;
  // Watch the parent so the first publication of DESIGN.md also refreshes Metro.
  fs.watch(root, { persistent: false }, (_, name) => {
    if (String(name) === 'DESIGN.md') {
      try { compile(); } catch (error) { console.error('[spk:design]', error.message); }
    }
  });
};
