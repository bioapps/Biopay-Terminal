
const UsbReader = require('../readers/UsbReader');
const NdefParser = require('../parsers/NdefParser');

// const Settings = require('../../utils/Settings');
// const chipData = Settings.getJSON('chip-data').map(value => parseInt(value, 16));

// console.log(NdefParser.parse(chipData));


const usbReader = new UsbReader();

usbReader.readTag()
	.then(bytesData => {
		console.log(NdefParser.getNdefRecords(bytesData));
	}, error => {
		console.error(error);
	});
