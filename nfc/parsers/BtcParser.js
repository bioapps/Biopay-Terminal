'use strict';

const btcIdentifier = 'btc:';
const splitCharacter = ';';

const BtcParser = {

	getBtcData(ndefRecords) {
		for (let i = 0; i < ndefRecords.length; i++) {
			const record = ndefRecords[i];

			if (record.type !== 'T') {
				continue;
			}

			const value = record.value;

			if (!value) {
				continue;
			}

			if (value.toLowerCase().substr(0, btcIdentifier.length) !== btcIdentifier) {
				continue;
			}

			const content = value.substr(4);

			let firstSplitCharater = content.indexOf(splitCharacter);
			if (firstSplitCharater === -1) {
				firstSplitCharater = content.length;
			}

			const username = content.substr(0, firstSplitCharater);
			const password = content.substr(firstSplitCharater + 1);

			return {
				username,
				password
			};
		}

		return null;
	}
};

module.exports = BtcParser;
