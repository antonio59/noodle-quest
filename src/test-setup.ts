import '@testing-library/jest-dom';

// jsdom has no canvas implementation — calling getContext logs a
// "Not implemented" jsdomError that races the vitest worker RPC close and
// intermittently fails the suite with EnvironmentTeardownError. Stub a
// minimal 2d context so canvas games mount silently; return null for
// anything else (webgl can't run in jsdom either way).
const ctx2d = () =>
  new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'canvas') return null;
        if (prop === 'measureText') return () => ({ width: 0 });
        if (prop === 'getImageData') return () => ({ data: [] });
        return () => {};
      },
      set: () => true,
    },
  );

// Worker-side console filtering. Every console call is forwarded to the
// main thread over RPC; a message landing while the worker is closing fails
// the whole run with EnvironmentTeardownError ("Closing rpc while
// onUserConsoleLog was pending"). Suppress the two known-benign sources:
//   - three.js "multiple instances" warning from lazy 3D chunks
//   - React act() warnings from async effects (e.g. Scrabble's dictionary
//     fetch) resolving between a smoke test's render and unmount
const CONSOLE_NOISE = [
  /Multiple instances of Three\.js/,
  /not wrapped in act\(/,
];
for (const method of ['error', 'warn', 'info', 'log', 'debug'] as const) {
  const orig = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    if (CONSOLE_NOISE.some(re => args.some(a => re.test(String(a))))) return;
    orig(...args);
  };
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
    if (type === '2d') return ctx2d();
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;
}
