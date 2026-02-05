enum LogColors {
	Debug = 0,
	Info = 1,
	Warn = 2,
	Errr = 3,
}

export const log = new class {
	private relTimeBase = performance.now()

	getRelativeTimeFormatted() {
		return `[]`
	}

	getCurrentTimeFormatted() {
		const now = new Date()

		return [
			`[${now.getFullYear()}/${`${now.getMonth()}`.padStart(2, "0")}/${`${now.getDate()}`.padStart(2, "0")}]`,
			`[${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}:${`${now.getSeconds()}`.padStart(2, "0")}.${`${now.getMilliseconds()}`.padStart(3,"0")}]`,
		]
	}

	async info(message: string) {
		console.log(this.getCurrentTimeFormatted())

		await new Promise<void>(res => res())
	}
}