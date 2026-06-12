import { log } from "/srv/log/"

export class IndexDBHelperClass {
	#tableQueue = Promise.resolve()

	async #getTx(table, mode, retries = 5) {
		await this.#tableQueue
		const db = await this.ready
		
		if (!db.objectStoreNames.contains(table)) return null

		try { return db.transaction(table, mode) }
		catch (err) {
			if (err.name === "InvalidStateError" && retries > 0) {
				await new Promise(r => setTimeout(r, 100))
				return this.#getTx(table, mode, retries - 1)
			}
			throw err
		}
	}
	#connect(version) {
		this.ready = new Promise((resolve, reject) => {
			const req = indexedDB.open("webdesk", version)
			req.onsuccess = () => {
				const db = req.result
				db.onversionchange = () => {
					db.close()
					this.#connect()
				}
				resolve(db)
			}
			req.onerror = reject
			req.onblocked = () => log.verb("Waiting for active IndexedDB transaction to close")
		})
	}
	async #run(table, mode, callback) {
		const db = await this.ready
		if (!db.objectStoreNames.contains(table)) return undefined
		return new Promise((resolve, reject) => {
			const tx = db.transaction(table, mode)
			const req = callback(tx.objectStore(table))
			req.onsuccess = () => resolve(req.result)
			req.onerror = () => reject(req.error)
		})
	}
	#runTable(tableName, requiresExisting, callback) {
		this.#tableQueue = this.#tableQueue.then(async () => {
			const db = await this.ready
			const exists = db.objectStoreNames.contains(tableName)

			if (requiresExisting ? !exists : exists) return

			const newVersion = db.version + 1
			db.close()

			this.ready = new Promise((resolve, reject) => {
				const req = indexedDB.open("webdesk", newVersion)

				req.onupgradeneeded = event => callback(event.target.result)
				req.onsuccess = () => {
					const newDb = req.result
					newDb.onversionchange = () => {
						newDb.close()
						// Ensure upgraded connections also auto-reconnect
						this.#connect() 
					}
					resolve(newDb)
				}
				req.onerror = () => reject(req.error)
				req.onblocked = () => log.verb("Waiting for active IndexedDB transaction to close")
			})

			await this.ready
		})

		return this.#tableQueue
	}
	async #checkStorageUsage() {
		if (navigator.storage && navigator.storage.estimate) {
			const { quota, usage } = await navigator.storage.estimate()
			log.verb(`Storage is using ${(usage / 1024 / 1024).toPrecision(5)}MB out of ${Math.round(quota / 1024 / 1024)}MB`)
		}
	}
	async #requestPersistentStorage() {
		if (navigator.storage && navigator.storage.persist) {
			const isPersisted = await navigator.storage.persist()
			log.verb(`IndexDB ${isPersisted ? "is" : "isn't"} persistent`)
			return isPersisted
		} else log.verb(`IndexDB isn't persistent`)
	}

	get(table, key) { return this.#run(table, "readonly", s => s.get(key)) }
	set(table, key, val) { return this.#run(table, "readwrite", s => s.put(val, key)) }
	delete(table, key) { return this.#run(table, "readwrite", s => s.delete(key)) }
	async getAll(table, asObject = false) {
		if (!asObject) return this.#run(table, "readonly", s => s.getAll())
		const db = await this.ready
		
		if (!db.objectStoreNames.contains(table)) return undefined
		return new Promise((resolve, reject) => {
			const store = db.transaction(table, "readonly").objectStore(table)
			const keysReq = store.getAllKeys()
			const valsReq = store.getAll()
			valsReq.onsuccess = () => {
				const result = { }
				keysReq.result.forEach((key, i) => result[key] = valsReq.result[i])
				resolve(result)
			}
			valsReq.onerror = reject
		})
	}
	createTable(tableName) { return this.#runTable(tableName, false, db => db.createObjectStore(tableName)) }
	deleteTable(tableName) { return this.#runTable(tableName, true, db => db.deleteObjectStore(tableName)) }

	constructor(skipUnsafeLogs = false) {
		if (skipUnsafeLogs) return this
		
		this.#connect()
		this.#requestPersistentStorage()
		this.#checkStorageUsage()
	}
}

export const IndexDB = new IndexDBHelperClass()