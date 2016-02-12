'use strict';

const expect = require('chai').expect;
const BtcParser = require('../parsers/BtcParser');

describe('BtcParser', () => {
	const username = '61635819163-81726281-1617182';
	const password = 'foo;:;123';

	it('should return credentials when an ndef record with btc data is present', () => {
		const ndefMessage = [{
			tnf: 1,
			type: 'T',
			id: [],
			payload: [2, 101, 110, 98, 116, 99, 58, 54, 49, 54, 51, 53, 56, 49, 57, 49, 54, 51, 45, 56, 49, 55, 50, 54, 50, 56, 49, 45, 49, 54, 49, 55, 49, 56, 50, 59, 102, 111, 111],
			value: `btc:${username};${password}`
		}];

		const res = BtcParser.getBtcData(ndefMessage);
		expect(res).to.deep.equal({
			username,
			password
		});
	});

	it('should return only username if no delimiter is in credentials-value', () => {
		const ndefMessage = [{
			tnf: 1,
			type: 'T',
			id: [],
			payload: [2, 101, 110, 98, 116, 99, 58, 54, 49, 54, 51, 53, 56, 49, 57, 49, 54, 51, 45, 56, 49, 55, 50, 54, 50, 56, 49, 45, 49, 54, 49, 55, 49, 56, 50, 59, 102, 111, 111],
			value: `btc:${username}`
		}];

		const res = BtcParser.getBtcData(ndefMessage);
		expect(res).to.deep.equal({
			username,
			password: ''
		});
	});

	it('should return null if there is no ndef record with btc data', () => {
		const ndefMessage = [{
			tnf: 0,
			type: 'foo',
			id: [],
			payload: []
		}, {
			tnf: 0,
			type: 'T',
			id: [],
			payload: [],
			value: 'foo'
		}];

		const res = BtcParser.getBtcData(ndefMessage);
		expect(res).to.be.null;
	});
});