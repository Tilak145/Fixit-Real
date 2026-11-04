const fs = require("node:fs");
const path = require("node:path");

/**
 * DESIGN.md, its tokens and its font assets belong to the whole project and sit
 * at the project root, which is the app folder only while the app itself lives
 * at the root. An app under apps/<name> must still compile the one project-wide
 * design, so walk up from the app folder to the folder that holds DESIGN.md.
 */
function findDesignRoot(appFolder, resourcePath) {
  let folder = appFolder;
  while (folder !== path.dirname(folder)) {
    const candidate = path.join(folder, "DESIGN.md");
    if (fs.existsSync(candidate)) return { root: folder, documentPath: candidate };
    folder = path.dirname(folder);
  }
  // No DESIGN.md anywhere above: compile the default palette from the app's own
  // folder, and keep watching for the file so saving one takes effect.
  const missing = path.join(appFolder, "DESIGN.md");
  return { root: appFolder, documentPath: missing, missing: true };
}

/** Webpack uses this same compiler in development watch mode and production. */
module.exports = function spkDesignLoader() {
  const done = this.async();
  const appFolder = path.resolve(path.dirname(this.resourcePath), "..");
  const found = findDesignRoot(appFolder, this.resourcePath);
  const documentPath = found.documentPath;
  if (!found.missing) this.addDependency(documentPath);
  else this.addMissingDependency(documentPath);
  import("./spk-design-compiler.mjs").then(({ parseDesignDocument, defaultDesignDocument, compileDesignCss }) => {
    const design = fs.existsSync(documentPath) ? parseDesignDocument(fs.readFileSync(documentPath, "utf8")) : defaultDesignDocument();
    for (const font of design.fonts) {
      // Font files ship with the app that renders them.
      const fontPath = path.join(appFolder, "public", font.src);
      this.addDependency(fontPath);
      if (!fs.existsSync(fontPath)) throw new Error(`DESIGN.md: font asset is missing: public${font.src}`);
    }
    done(null, this.resourcePath.endsWith(".mjs")
      ? `export default ${JSON.stringify({ defaultTheme: design.defaultTheme, themes: Object.keys(design.themes) })};\n`
      : compileDesignCss(design));
  }).catch((error) => done(error));
};
