// TODO: log verbose

import { config } from "../server.config.ts"

enum LogColors {
	TIME = "color: darkgray",
	DEBUG = "color: cyan",
	INFO = "color: green",
	WARN = "color: yellow",
	ERROR = "color: red"
}

enum LogDecorations {
	DEBUG = "",
	INFO = "",
	WARN = "text-decoration: underline",
	ERROR = "font-weight: bold"
}

export const log = new class {
	private relTimeBase = performance.now()

	private getRelTime() {
		const now = performance.now()
		const passMills = now - this.relTimeBase

		const secs = (passMills / 1000) % 60
		const mins = Math.floor(passMills / (60 * 1000))
		const hour = Math.floor(passMills / (60 * 60 * 1000))
		const days = Math.floor(passMills / (24 * 60 * 60 * 1000))

		return `[${`${days}`.padStart(3, "0")}:${`${hour}`.padStart(2, "0")}:${`${mins}`.padStart(2, "0")}:${`${secs.toFixed(3)}`.padStart(6, "0")}]`
	}

	private getAbsTime() {
		const now = new Date()

		return [
			`[${`${now.getDate()}`.padStart(2, "0")}/${`${now.getMonth() + 1}`.padStart(2, "0")}/${now.getFullYear()}]`,
			`[${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}:${`${now.getSeconds()}`.padStart(2, "0")}.${`${now.getMilliseconds()}`.padStart(3,"0")}]`,
		]
	}

	async debug(message: string) {
		if (!config.logDebug) { return }
		const absTime = this.getAbsTime(), relTime = this.getRelTime()

		console.log(`%c●    %c${absTime.join("    ")}    ${relTime}    %c${message}`, LogColors.DEBUG, LogColors.TIME, `${LogColors.DEBUG};${LogDecorations.DEBUG}`)
		await new Promise<void>(res => res())
	}

	async info(message: string) {
		const absTime = this.getAbsTime(), relTime = this.getRelTime()

		console.log(`%c▲    %c${absTime.join("    ")}    ${relTime}    %c${message}`, LogColors.INFO, LogColors.TIME, `${LogColors.INFO};${LogDecorations.INFO}`)
		await new Promise<void>(res => res())
	}

	async warn(message: string) {
		const absTime = this.getAbsTime(), relTime = this.getRelTime()

		console.warn(`%c◼    %c${absTime.join("    ")}    ${relTime}    %c${message}`, LogColors.WARN, LogColors.TIME, `${LogColors.WARN};${LogDecorations.WARN}`)
		await new Promise<void>(res => res())
	}

	async printStack(errorStack?: string) {
		if (!errorStack) { return }

		for (const line of errorStack.split("\n")) { log.warn(line) }

		await new Promise<void>(res => res())
	}

	async error(message: string) {
		const absTime = this.getAbsTime(), relTime = this.getRelTime()

		console.error(`%c⬟    ${absTime.join("    ")}    ${relTime}    %c${message}`, LogColors.ERROR, `${LogColors.ERROR};${LogDecorations.ERROR}`)
		await new Promise<void>(res => res())
	}
}