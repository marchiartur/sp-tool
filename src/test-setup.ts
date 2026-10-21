// vite.ext.config.ts replaces __SP_DEV__ at build time, so under vitest nothing defines
// it and any module reading it would throw. Tests run against release behaviour (false);
// a test that wants the dev branch can override it with vi.stubGlobal.
Object.defineProperty(globalThis, "__SP_DEV__", { value: false, writable: true, configurable: true })

export {}
