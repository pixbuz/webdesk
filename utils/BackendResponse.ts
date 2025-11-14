export class ResponseFormat {
	message: any
	returnedError: boolean

	constructor() {
		this.message = null
		this.responseFunction = ""
		this.returnedError = false
	}
}