const fs = require('fs');

fs.writeFileSync('package.json', JSON.stringify({
  name: "game-engine",
  version: "1.0.0",
  description: "Super Ace Game Engine",
  main: "dist/index.js",
  scripts: {
    dev: "nodemon --watch src --ext ts --exec ts-node src/index.ts",
    build: "tsc",
    start: "node dist/index.js"
  },
  author: "slim_shafin",
  license: "ISC"
}, null, 2), 'utf8');

fs.writeFileSync('tsconfig.json', JSON.stringify({
  compilerOptions: {
    target: "ES2020",
    module: "commonjs",
    lib: ["ES2020"],
    outDir: "./dist",
    rootDir: "./src",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true
  },
  include: ["src/**/*"],
  exclude: ["node_modules", "dist"]
}, null, 2), 'utf8');

console.log('package.json and tsconfig.json done!');