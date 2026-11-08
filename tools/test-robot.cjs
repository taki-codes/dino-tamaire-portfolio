// Run the existing pure game simulation without Metro or a physical device.
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const {outputText} = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
    fileName: filename,
  });
  module._compile(outputText, filename);
};

// Keep random panel layouts and CPU decisions reproducible in this test process.
let seed = 20261108;
Math.random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
require('./robot-sim-test.ts');
