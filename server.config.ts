// TODO: Make this do more
export const config = Object.freeze({
	staticFolder: "static",
	hostname: "0.0.0.0",
	appFolder: "apps",
	logLevel: 0,
	port: 8000,
	ssl: false,
	cert: "",
	key: "",
} as const)