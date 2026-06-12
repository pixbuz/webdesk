export class ApplicationManifestFrontend {
	icon: string = ""
	index: string = ""
	launcher: boolean = false
	routes: Record<string, string> = {}

	constructor(frontend?: Partial<ApplicationManifestFrontend>) {
		Object.assign(this, frontend ?? { })
		this.index = frontend?.index ?? ""
		this.icon = frontend?.icon ?? ""
		this.launcher = frontend?.launcher ?? false
		this.routes = frontend?.routes ?? {}
	}
}

export class ApplicationManifestBackend {
	level: number = 2
	modules: string[] = []

	constructor(backend?: Partial<ApplicationManifestBackend>) {
		if (backend) Object.assign(this, backend)
		this.level = backend?.level ?? 2
		this.modules = backend?.modules ?? []
	}
}

export class ApplicationManifest {
	name: string
	description: string
	domain: string
	
	frontend: ApplicationManifestFrontend
	backend: ApplicationManifestBackend

	constructor(path: string, manifest: Partial<ApplicationManifest>) {
		this.name = manifest.name ?? path
		this.domain = manifest.domain ?? path
		this.description = manifest.description ?? ""
		this.frontend = new ApplicationManifestFrontend(manifest.frontend)
		this.backend = new ApplicationManifestBackend(manifest.backend)
	}
}

export type LookupFileEntry = {
	type: "file"
	path: string
	mime: string
	size: number
	extension: string
}

export type LookupCommandEntry = {
	type: "command"
	callback: ApplicationCommand
	name: string
}

export type LookupEntry = LookupFileEntry | LookupCommandEntry

export type ApplicationModule = {
	map: Record<string, Function>
}

export type WrappedRequest = {
	request: Request
	pathname: string
	url: URL
}

export type ThinResponse = {
	bypass?: boolean
	content: unknown
	code: number
	mime: string
	headers?: Record<string, string>
}

export type CacheEntry = {
	response?: ThinResponse
	points: number
	size: number
}

export type EventFunction = (data: object) => unknown

export type ApplicationCommand = (req: Request) => Promise<Response | Partial<ThinResponse> | void>