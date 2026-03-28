enum Platforms {
	WINDOWS,
	LINUX
}

// TODO: Make this do more
export const config = Object.freeze({
	platform: Platforms.WINDOWS,
	staticFolder: "static",
	hostname: "localhost",
	appFolder: "apps",
	logDebug: true,
	port: 8000,
	ssl: false,
	cert: "",
	key: "",
} as const)