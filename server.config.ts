// TODO: Make this do more
export const config = Object.freeze({
	staticFolder: "static",
	hostname: "0.0.0.0",
	appFolder: "apps",
	logDebug: true,
	port: 80,
	ssl: false,
	cert: "",
	key: "",
} as const)