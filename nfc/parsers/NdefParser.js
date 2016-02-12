'use strict';

const assert = require('assert');
const ndef = require('ndef');

const TlvTypes = {
	Null: 0x00,			// Block is to be ignored
	Ndef: 0x03,			// Block contains an Ndef message
	Proprietary: 0xFD,	// Block contains proprietary information
	Terminator: 0xFE	// Last TLV block in data area
};


const NdefParser = {

	getNdefRecords(bytes) {
		assert(bytes.length === +bytes.length, 'Bytes data does not have a propert length type');
		assert(
			typeof bytes.shift === 'function' &&
			typeof bytes.splice === 'function',
			'Bytes has to support shift/splice function'
		);

		bytes = bytes.slice(0); // Copy byte since parsing is destructive

		let res = [];
		while (bytes.length) {
			const tlvType = bytes.shift();
			let tlvLength = bytes.shift(); 

			//
			// Skip block with lengths of zero
			//
			if (tlvLength === 0x00) {
				continue;
			}

			//
			// A length of 0xFF indicates that the actual length is stored in the next two bytes
			//
			if (tlvLength === 0xFF) {
				tlvLength = (bytes.shift() << 8) + bytes.shift();
			}

			switch (tlvType) {
				case TlvTypes.Null:
					// console.info('Null block type, skipping.');
					bytes.splice(0, tlvLength);
					continue;

				case TlvTypes.Ndef:
					res = NdefParser.parseNdefBlock(bytes.splice(0, tlvLength));
					break;

				case TlvTypes.Proprietary:
					// console.info('Proprietary block type, skipping.');
					bytes.splice(0, tlvLength);
					continue;

				case TlvTypes.Terminator:
					// console.info('Terminator block, ending.');
					break;

				default:
					// throw Error('Unknown block type detected', tlvType.toString(16));
					break;
			}
		}

		return res;

	},

	parseNdefBlock(bytes) {
		return ndef.decodeMessage(bytes);
	}
};

module.exports = NdefParser;
