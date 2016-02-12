'use strict';

require('colors');

const pcsc = require('pcsclite')();
const ndef = require('ndef');

pcsc.on('error', error => console.log(`PCSC error`, error));

// SCARD_SHARE_SHARED 2
// SCARD_SHARE_EXCLUSIVE 1
// SCARD_SHARE_DIRECT 3
// SCARD_PROTOCOL_T0 1
// SCARD_PROTOCOL_T1 2
// SCARD_PROTOCOL_RAW 65536
// SCARD_STATE_UNAWARE 0
// SCARD_STATE_IGNORE 1
// SCARD_STATE_CHANGED 2
// SCARD_STATE_UNKNOWN 4
// SCARD_STATE_UNAVAILABLE 8
// SCARD_STATE_EMPTY 16
// SCARD_STATE_PRESENT 32
// SCARD_STATE_ATRMATCH 64
// SCARD_STATE_EXCLUSIVE 128
// SCARD_STATE_INUSE 256
// SCARD_STATE_MUTE 512
// SCARD_LEAVE_CARD 0
// SCARD_RESET_CARD 1
// SCARD_UNPOWER_CARD 2
// SCARD_EJECT_CARD 3


pcsc.on('reader', reader => {
	console.log(`Card Reader: (${reader.name})`);
	console.log(reader);

	reader.on('error', console.log.bind(console));
	reader.on('end', () => console.log(`Reader ${reader.name} removed`));

	reader.on('status', status => {
		const changes = reader.state ^ status.state;
		if (!changes) {
			return;
		}

		// Removed
		if ((changes & reader.SCARD_STATE_EMPTY) && (status.state & reader.SCARD_STATE_EMPTY)) {
			console.log('No card on reader');

			if (reader.connected) {
				reader.disconnect(reader.SCARD_LEAVE_CARD, error => console.log(error || 'Disconnected card'));
			}

			return;
		}


		if (changes & reader.SCARD_STATE_PRESENT && (status.state & reader.SCARD_STATE_PRESENT)) {
			console.log('Connecting to reader');

			connect(reader)
				.then(() => transmit(reader, [0xff, 0x00, 0x52, 0x00, 0x00], false)) // Disable standard buzzer (disabled until reader is rebooted)
				// .then(() => transmit(reader, [0xff, 0xca, 0x00, 0x00, 0x04])) // Get UID in APDU format
				// .then(() => transmit(reader, [0xff, 0xca, 0x01, 0x00, 0x04])) // Get ATS, not supported
				// .then(() => transmit(reader, [0xff, 0x00, 0x50, 0x00, 0x00])) // Get PICC Operating Parameter
				// .then(() => transmit(reader, [0xff, 0x00, 0x40, 0xcf, 0x04, 0x03, 0x00, 0x01, 0x01])) // Buzz and show orange light
				// .then(() => transmit(reader, [0xff, 0xb0, 0x00, 0x00, 0x04], 'buffer')) // Read binary block
				// .then(() => transmit(reader, [0xff, 0x00, 0x40, 0x0f, 0x04, 0x00, 0x00, 0x00, 0x00])) // Turn on red and green (orange)
				.then(() => {
					// console.log('-----');
					// printBlocks(reader, 0x00, 0xFF);

					readTag(reader).then(buffer => {
						console.log(buffer.toString('utf8'));
						console.log(ndef.decodeMessage(buffer.toJSON().data.slice(2)));
						parseNdef(buffer.slice(2));
					});
				})
				.catch(error => console.log(`ERROR: ${JSON.stringify(error)}`.red));
		}
	});
});

function parseNdef(bytes) {
	// https://www.safaribooksonline.com/library/view/beginning-nfc/9781449324094/ch04.html
	// https://learn.adafruit.com/adafruit-pn532-rfid-nfc/ndef
	// http://www.eet-china.com/ARTICLES/2006AUG/PDF/NFCForum-TS-NDEF.pdf
	// 
	// Record header
	// Start
	// 
	const tnfByte = bytes[0];
	const typeLength = bytes[1];
	const payloadLength = bytes.slice(2, 6);
	const idLength = bytes[6];
	const payloadType = bytes.slice(7, 7 + typeLength);
	const payloadId = bytes.slice(7 + typeLength, 7 + typeLength + idLength);

	const header = parseTnf(tnfByte);
	console.log(tnfByte.toString(16), header);

	// Record header - End
}

function parseTnf(tnfByte) {
	return {
		MB: (tnfByte & 0x80) !== 0,
		ME: (tnfByte & 0x40) !== 0,
		CF: (tnfByte & 0x20) !== 0,
		SR: (tnfByte & 0x10) !== 0,
		IL: (tnfByte & 0x08) !== 0,
		tnf: tnfByte & 0x07
	};
}

function readTag(reader) {
	return new Promise((resolve/*, reject*/) => {
		console.time('Reading blocks');
		const allBuffers = [];

		const blockReadCount = 1;
		const command = [0xff, 0xb0, 0x00, '_page_', 0x04 * blockReadCount];

		let promise = new Promise(resolve => resolve());
		for (let page = 0x04; page < 0xff; page += blockReadCount) {
			promise = promise.then(() => {
				command[3] = page;
				return transmit(reader, command, false).then(response => {
					allBuffers.push(response.data);
				});
			});
		}

		//
		// Don't know how to read capacity of a tag, so we treat errors as we have reached the end
		//
		promise.catch(() => {
			console.log('Catched error when reading tag, treating as end of data.'.green);
			console.timeEnd('Reading blocks');

			const bufferData = [];
			allBuffers.forEach(chunk => {
				for (let i = 0; i < chunk.length; i++) {
					bufferData.push(chunk[i]);
				}
			});
			const buffer = new Buffer(bufferData);

			resolve(buffer);
		});
	});
}

function printBlocks(reader, startBlock, endBlock, blockLength) {
	let promise = new Promise(resolve => resolve());

	blockLength = blockLength || 0x04;
	for (let block = startBlock; block < endBlock; block += blockLength / 0x04) {
		promise = promise.then(() => {
			return transmit(reader, [0xff, 0xb0, 0x00, block, Math.min((endBlock - block) * 0x04, blockLength)], false)
				.then(response => {
					console.log(`[${bufferToHexArray(response.data).join(' ')}]`.yellow, `${response.data.toString('utf8').replace(/[\n\r]/g, '•')}`.cyan);
				});
		});
	}

	promise.catch(error => console.log(`ERROR: ${JSON.stringify(error)}`.red));

	return promise;
}


function connect(reader) {
	return new Promise((resolve, reject) => {
		reader.connect({
			share_mode: reader.SCARD_SHARE_SHARED
		}, (error, protocol) => {
			reader._protocol = protocol;

			if (error) {
				reject(error);
			} else {
				resolve(protocol);
			}
		});
	});
}

function transmit(reader, data, output) {
	return new Promise((resolve, reject) => {
		reader.transmit(
			new Buffer(data),
			255,
			reader._protocol || (reader.SCARD_PROTOCOL_T0 | reader.SCARD_PROTOCOL_T1),
			(error, apdu) => {
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
						errorCode: bufferToHexArray(responseCode),
						errorData: responseData
					});
					return;
				}

				if (output !== false) {
					printBuffer(responseData, output);
				}

				resolve({
					responseCode: responseCode,
					data: responseData,
					apdu: apdu
				});
			}
		);
	});
}

function bufferToHexArray(buffer, prefix) {
	return buffer.toJSON().data.map(val => {
		const hex = val.toString(16).toUpperCase();
		return `${prefix === true ? '0x' : ''}${hex.length === 1 ? '0' + hex : hex}`;
	});
}

function printBuffer(buffer, output) {
	if (typeof output !== 'string') {
		output = 'buffer';
	}

	if (output === 'all') {
		output = 'buffer,utf8,ascii';
	}

	output = output.toLowerCase();

	if (output.indexOf('buffer') !== -1) {
		const bufferArr = bufferToHexArray(buffer);
		console.log(`buffer: [${bufferArr.join(', ')}]`.yellow);
	}

	if (output.indexOf('utf8') !== -1) {
		console.log(`utf8: ${buffer.toString('utf8')}`.cyan);
	}

	if (output.indexOf('ascii') !== -1) {
		console.log(`ascii: ${buffer.toString('ascii')}`.magenta);
	}
}
