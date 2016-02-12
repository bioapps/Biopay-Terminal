'use strict';

require('colors');

const _ = require('lodash');
const pcsclite = require('pcsclite');


// Utils
function now() {
	const t = process.hrtime();
	return t[0] * 1e9 + t[1];
}


//
// Usb Reader
// ACR122u
// http://downloads.acs.com.hk/drivers/en/API-ACR122U-2.02.pdf
//
class UsbReader {
	constructor() {
		const pcsc = this.pcsc = pcsclite();

		this.pendingRead = false;

		_.bindAll(this, 'onPCSCError', 'onPCSCReader', 'onReaderStatus', 'onReaderEnd', 'onReaderError');

		pcsc.on('error', this.onPCSCError);
		pcsc.on('reader', this.onPCSCReader);
	}


	readTag(eventEmitter) {
		if (this.reader && this.reader.connected) {
			return this.readAllData();
		}

		let resolve, reject;
		const pendingReading = this.pendingReading = new Promise((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		});
		pendingReading.resolve = resolve;
		pendingReading.reject = reject;
		pendingReading.eventEmitter = eventEmitter || null;

		return pendingReading;
	}

	checkForPending() {
		if (this.pendingReading) {
			if (this.pendingReading.eventEmitter) {
				this.pendingReading.eventEmitter.emit('processing');
			}

			this.readAllData()
				.then(data => {
					this.pendingReading.resolve(data);
					this.pendingReading = null;
				})
				.catch(error => this.pendingReading.reject(error));
		}
	}

	readAllData() {
		return new Promise((resolve/*, reject*/) => {
			const startTime = now();
			const allBuffers = [];

			const blockReadCount = 4; // Max is 4
			const command = [0xff, 0xb0, 0x00, '_page_', 0x04 * blockReadCount];

			let promise = new Promise(resolve => resolve());
			for (let page = 0x04; page < 0xff; page += blockReadCount) {

				promise = promise.then(() => {
					process.stdout.write(`Reading block 0x04-0x${page.toString(16).toUpperCase()}, (${(now() - startTime) / 1e9} s)\r`.cyan);

					command[3] = page;
					return this.transmitToCard(command).then(response => {
						allBuffers.push(response.data);
					});
				});
			}

			//
			// Don't know how to read capacity of a tag, so we treat errors as we have reached the end
			//
			promise.catch((/* error */) => {
				console.log(); // newline to flush output

				const bytesData = [];
				allBuffers.forEach(chunk => {
					for (let i = 0; i < chunk.length; i++) {
						bytesData.push(chunk[i]);
					}
				});

				resolve(bytesData);
			});
		});
	}


	//
	// Promise based abstraction of reader methods
	//
	connectToCard() {
		const reader = this.reader;
		const options = {
			share_mode: reader.SCARD_SHARE_SHARED
		};

		return new Promise((resolve, reject) => {
			reader.connect(options, (error, protocol) => {
				reader._protocol = protocol;

				if (error) {
					reject(error);
				} else {
					resolve(protocol);
				}
			});
		});
	}

	transmitToCard(bytes) {
		const reader = this.reader;
		const buffer = new Buffer(bytes);
		const maxResponseLength = 255;
		const protocol = reader._protocol || (reader.SCARD_PROTOCOL_T0 | reader.SCARD_PROTOCOL_T1);

		return new Promise((resolve, reject) => {
			reader.transmit(buffer, maxResponseLength, protocol, (error, apdu) => {
				if (error) {
					reject(error);
					return;
				}

				const responseCode = apdu.slice(-2);
				const responseData = apdu.slice(0, -2);

				//
				// Last 2 bytes will be response codes indicating status
				// In most cases, these codes are relevant:
				//	Success: 0x90 0x00
				//	Error  : 0x63 0x00
				//
				// if (responseCode[0] === 0x63 && responseCode[1] === 0x00) { // Error code response
				if (responseCode[0] !== 0x90 || responseCode[1] !== 0x00) { // Error code response
					reject({
						errorType: 'Error response from reader',
						errorCode: responseCode,
						errorData: responseData
					});
					return;
				}

				resolve({
					responseCode: responseCode,
					data: responseData,
					apdu: apdu
				});
			});
		});
	}


	//
	// Reader Events
	//
	onReaderStatus(status) {
		const reader = this.reader;
		
		const changes = reader.state ^ status.state;
		if (!changes) {
			return;
		}

		//
		// Card has been removed
		//
		if ((changes & reader.SCARD_STATE_EMPTY) && (status.state & reader.SCARD_STATE_EMPTY)) {
			console.info('No card on reader'.yellow);

			if (reader.connected) {
				reader.disconnect(reader.SCARD_LEAVE_CARD, error => console.log(error || 'Disconnected card'));
			}

			return;
		}

		//
		// Card has been detcted
		//
		if (changes & reader.SCARD_STATE_PRESENT && (status.state & reader.SCARD_STATE_PRESENT)) {
			this.connectToCard()
				.then(() => this.checkForPending());
		}
	}

	onReaderEnd() {
		// Maybe need to unbind event listeners
		console.info('Reader removed'.yellow);
	}

	onReaderError(error) {
		console.info('Reader error'.red, error);
	}

	//
	// PCSC Events
	//
	onPCSCReader(reader) {
		this.reader = reader;

		reader.on('status', this.onReaderStatus);
		reader.on('error', this.onReaderError);
		reader.on('end', this.onReaderEnd);
	}

	onPCSCError(error) {
		console.info('PCSC error'.red, error);
	}


	//
	// Helpers
	//
	bufferToHexArray(buffer, prefix) {
		return buffer.toJSON().data.map(val => {
			const hex = val.toString(16).toUpperCase();
			return `${prefix === true ? '0x' : ''}${hex.length === 1 ? '0' + hex : hex}`;
		});
	}
}

module.exports = UsbReader;
