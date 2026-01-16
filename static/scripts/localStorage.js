;(async () => {
	await WebdeskDB.createTable("settings")

	await WebdeskDB.set("settings", "test", 123)

	await WebdeskDB.get("settings", "test")
})();

;(async () => {
	await WebdeskDB.createTable("Global")

	await WebdeskDB.set("Global", "test", 123)

	await WebdeskDB.get("Global", "test")
})();