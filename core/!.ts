#!/usr/bin/env node

/** @internal */
declare const NODE: boolean;
if (typeof NODE === "undefined")
	Object.assign(globalThis, { NODE: typeof process === "object" && typeof onclick === "undefined" });

/** @internal */
declare const TAURI: boolean;
if (typeof TAURI === "undefined")
	Object.assign(globalThis, { TAURI: typeof window !== "undefined" && typeof (window as any).__TAURI__ !== "undefined" });

/** @internal */
declare const WEB: boolean;
if (typeof WEB === "undefined")
	Object.assign(globalThis, { WEB: typeof window !== "undefined" && !NODE && !TAURI });
