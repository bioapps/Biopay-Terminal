'use strict';

const expect = require('chai').expect;
const NdefParser = require('../parsers/NdefParser');

const Settings = require('../../utils/Settings');

function getChipData(name) {
	return Settings.getJSON(`chip-data/${name}`).map(value => parseInt(value, 16));
}

describe('NdefParser', () => {

	it('should not alter the passed in byte data', () => {
		const chipData = getChipData('patric');
		const data = chipData.slice(0);

		expect(data).to.deep.equal(chipData);

		NdefParser.getNdefRecords(chipData);

		expect(data).to.deep.equal(chipData);
	});

	it('should return an array of ndef records when proper data is passed in', () => {
		const chipData = getChipData('patric');
		const ndefMessage = NdefParser.getNdefRecords(chipData);
		expect(ndefMessage).to.be.instanceof(Array);

		const record = ndefMessage[0];
		expect(record).to.be.an('object');
		expect(record.payload).to.be.instanceof(Array);
	});

	it('should return an empty array when chip data is empty', () => {
		const chipData = getChipData('empty');
		const ndefMessage = NdefParser.getNdefRecords(chipData);
		expect(ndefMessage).to.be.instanceof(Array);
		expect(ndefMessage).to.be.empty;
	});

	it('should parse v-card as a ndef record', () => {
		const chipData = getChipData('vcard');
		const ndefMessage = NdefParser.getNdefRecords(chipData);
		expect(ndefMessage).to.be.instanceof(Array);
		expect(ndefMessage).to.have.length(1);

		const record = ndefMessage[0];
		expect(record).to.be.an('object');
		expect(record.tnf).to.equal(2);
		expect(record.type).to.equal('text/x-vCard');
	});

	it('should parse plain text as a ndef record', () => {
		const chipData = getChipData('plain-text');
		const ndefMessage = NdefParser.getNdefRecords(chipData);
		expect(ndefMessage).to.be.instanceof(Array);
		expect(ndefMessage).to.have.length(1);

		const record = ndefMessage[0];
		expect(record).to.be.an('object');
		expect(record.tnf).to.equal(1);
		expect(record.type).to.equal('T');
		expect(record.value).to.be.a('string');
	});

	it('should properly parse a message with old data sitting after the message', () => {
		const chipData = getChipData('plain-text-with-old-vcard');
		const ndefMessage = NdefParser.getNdefRecords(chipData);
		expect(ndefMessage).to.be.instanceof(Array);
		expect(ndefMessage).to.have.length(1);

		const record = ndefMessage[0];
		expect(record).to.be.an('object');
		expect(record.tnf).to.equal(1);
		expect(record.type).to.equal('T');
		expect(record.value).to.be.a('string');
	});
});
