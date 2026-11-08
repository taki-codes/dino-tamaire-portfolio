const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');

const jobs = [
  ['icon.svg', 'out/icon.png', 1024],
  ['foreground.svg', 'out/android-icon-foreground.png', 1024],
  ['background.svg', 'out/android-icon-background.png', 1024],
  ['monochrome.svg', 'out/android-icon-monochrome.png', 1024],
  ['icon.svg', 'out/favicon.png', 196],
];

fs.mkdirSync('out', { recursive: true });
for (const [src, dst, size] of jobs) {
  const svg = fs.readFileSync(src, 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(dst, png);
  console.log(dst, size + 'px', png.length + ' bytes');
}
