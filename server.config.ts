// TODO: Make this do more
// TODO: add debug logging enabling
export const config = Object.freeze({
	staticFolder: "static",
	hostname: "localhost",
	appFolder: "apps",
	logDebug: true,
	port: 8000,
	ssl: false,
	cert: "",
	key: "",
} as const)