const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function findChromeBinary() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const playwrightCache = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(playwrightCache)) return undefined;

  const headlessShells = fs
    .readdirSync(playwrightCache)
    .filter((entry) => entry.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()
    .map((entry) =>
      path.join(playwrightCache, entry, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'),
    );

  return headlessShells.find((candidate) => fs.existsSync(candidate));
}

const chromeBinary = findChromeBinary();
if (chromeBinary) {
  process.env.CHROME_BIN = chromeBinary;
}

// Karma configuration for reliable local/CI Angular test execution.
module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-dev-shm-usage'],
      },
    },
    reporters: ['progress', 'kjhtml'],
    hostname: '127.0.0.1',
    listenAddress: '127.0.0.1',
    port: 0,
    browserNoActivityTimeout: 60000,
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 2,
    client: {
      clearContext: false,
    },
    restartOnFileChange: false,
  });
};
