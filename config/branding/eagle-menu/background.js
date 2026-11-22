// Relays requests from the start page to the EAGLE-OS helper.
browser.runtime.onMessage.addListener((msg) => browser.runtime.sendNativeMessage("eagle", msg));
