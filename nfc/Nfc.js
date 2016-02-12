'use strict';

require('colors');

// Readers
const UsbReader = require('./readers/UsbReader');
// Parsers
const NdefParser = require('./parsers/NdefParser');
const BtcParser = require('./parsers/BtcParser');


const baseConfig = {
	readerType: 'usb'
};


/**
 * Nfc
 */
module.exports = class Nfc {
	constructor(config) {
		this.config = Object.assign({}, baseConfig, config);

		this.setupReader();
	}

	setupReader() {
		this.reader = null;
		
		switch (this.config.readerType) {
			case 'usb':
				this.reader = new UsbReader();
				break;

			default:
				throw new Error(`No supported reader type submitted to Nfc, readerType: ${this.config.readerType}`);
		}
	}

	getTypeData(type, eventEmitter) {
		return this.readTag(eventEmitter)
			.then(byteData => NdefParser.getNdefRecords(byteData))
			.then(ndefRecords => this.findTypeData(type, ndefRecords));
	}

	readTag(eventEmitter) {
		return this.reader.readTag(eventEmitter);
	}

	findTypeData(type, ndefRecords) {
		let data = null;

		switch (type) {
			case 'bitcoins':
				data = BtcParser.getBtcData(ndefRecords);
				break;
		}

		if (data === null) {
			throw new Error(`No ${type} data found in ndef-records`);
		}

		return data;
	}
};
