const database = new WebdeskDatabase()
const database1 = new WebdeskDatabase();

(async () => {
	await database.createTable("settings")
	await database1.createTable("Global")

	await database.set("settings", "test", 123)
	await database1.set("Global", "test", 321)

	await database.get("settings", "test")
	await database1.get("Global", "test")
})()