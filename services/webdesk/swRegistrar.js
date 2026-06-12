import { log } from "/srv/log/"

if ("serviceWorker" in navigator) {
	globalThis.addEventListener("load", () => {
		navigator.serviceWorker.register("/sw", { type: "module" })
			.then(reg => log.info(`Successfully registered service worker`))
			.catch(error => log.warn(`Service worker registration failed:\n${error.stack}`))
	})
} else log.dbug(`Not able to register service worker`)

globalThis.addEventListener("online", () => {
	const controller = navigator.serviceWorker.controller
	if (controller) {
		log.info("Back online. Notifying Service Worker to replay requests")
		controller.postMessage({ action: "FLUSH_QUEUE" })
	}
})

globalThis.addEventListener("offline", () => {
	log.warn("Internet connection lost. Saving requests to be replayed on restore")
})