import { config } from "../server.config.ts"

enum LogColors {
	TIME = "color: darkgray",
	VERBOSE = "color: darkgray",
	DEBUG = "color: cyan",
	INFO = "color: green",
	WARN = "color: yellow",
	ERROR = "color: red"
}

enum LogDecorations {
	VERBOSE = "font-style: italic",
	DEBUG = "",
	INFO = "",
	WARN = "text-decoration: underline",
	ERROR = "font-weight: bold"
}

export const log = new class {
	private startTime = performance.now()
	private spaces = " ".repeat(2)

	private getRelTime() {
		const now = performance.now()
		const passMills = now - this.startTime

		const secs = ( (passMills / 1000) % 60 ).toFixed(3).toString().padStart(6, "0")
		const mins = ( Math.floor(passMills / (60 * 1000)) % 60 ).toString().padStart(2, "0")
		const hour = ( Math.floor(passMills / (60 * 60 * 1000)) % 24 ).toString().padStart(2, "0")
		const days = ( Math.floor(passMills / (24 * 60 * 60 * 1000)) ).toString().padStart(3, "0")

		return `[${days}|${hour}:${mins}:${secs}]`
	}

	private getAbsTime() {
		const now = new Date(),
			day = now.getDate().toString().padStart(2, "0"),
			month = (now.getMonth() + 1).toString().padStart(2, "0"),
			year = (now.getFullYear())

		const hours = now.getHours().toString().padStart(2, "0"),
			minutes = now.getMinutes().toString().padStart(2, "0"),
			seconds = now.getSeconds().toString().padStart(2, "0"),
			mills = now.getMilliseconds().toString().padStart(3, "0")

		return [
			`(${year}/${month}/${day})`,
			`[${hours}:${minutes}:${seconds}.${mills}]`,
		]
	}

	async verbose(message: string) {
		if (config.logLevel > 0) return
		const absTime = this.getAbsTime(), relTime = this.getRelTime()

		console.log(`%c○${this.spaces}%c${absTime.join(this.spaces)}${this.spaces}${relTime}${this.spaces}%c${message}`, LogColors.VERBOSE, LogColors.TIME, `${LogColors.VERBOSE};${LogDecorations.VERBOSE}`)
		await new Promise<void>(res => res())
	}

	async debug(message: string) {
		if (config.logLevel > 1) return
		const absTime = this.getAbsTime(), relTime = this.getRelTime()

		console.log(`%c●${this.spaces}%c${absTime.join(this.spaces)}${this.spaces}${relTime}${this.spaces}%c${message}`, LogColors.DEBUG, LogColors.TIME, `${LogColors.DEBUG};${LogDecorations.DEBUG}`)
		await new Promise<void>(res => res())
	}

	async info(message: string) {
		if (config.logLevel > 2) return
		const absTime = this.getAbsTime(), relTime = this.getRelTime()

		console.log(`%c▲${this.spaces}%c${absTime.join(this.spaces)}${this.spaces}${relTime}${this.spaces}%c${message}`, LogColors.INFO, LogColors.TIME, `${LogColors.INFO};${LogDecorations.INFO}`)
		await new Promise<void>(res => res())
	}

	async warn(message: string) {
		if (config.logLevel > 3) return
		const absTime = this.getAbsTime(), relTime = this.getRelTime()

		console.warn(`%c◼${this.spaces}%c${absTime.join(this.spaces)}${this.spaces}${relTime}${this.spaces}%c${message}`, LogColors.WARN, LogColors.TIME, `${LogColors.WARN};${LogDecorations.WARN}`)
		await new Promise<void>(res => res())
	}

	async printStack(errorStack?: string) {
		if (!errorStack) return
		for (const line of errorStack.split("\n")) { log.warn(line) }
		await new Promise<void>(res => res())
	}

	async error(message: string) {
		if (config.logLevel > 4) return
		const absTime = this.getAbsTime(), relTime = this.getRelTime()

		console.error(`%c⬟${this.spaces}${absTime.join(this.spaces)}${this.spaces}${relTime}${this.spaces}%c${message}`, LogColors.ERROR, `${LogColors.ERROR};${LogDecorations.ERROR}`)
		await new Promise<void>(res => res())
	}
}