'use strict';

require('colors');

const blockchain = require('blockchain.info');
const BitcoinUtils = require('biopay-bitcoins-lib').BitcoinUtils;
const LocalWalletService = require('local-wallet-service');
const request = require('request');

const baseConfig = {
	xPub: null,
	receiveApiCode: null,

	walletApiCode: null,

	callbackUrl: null
};

module.exports = class BlockchainService {
	constructor(config) {
		this.config = Object.assign({}, baseConfig, config);

		if (!this.config.xPub) {
			throw Error('No xPub address supplied to the Blockchain service');
		}

		if (!this.config.receiveApiCode && !this.config.oldReceiveAddress) {
			throw Error('No receive api code supplied to the Blockchain service');
		}

		if (!this.config.walletApiCode) {
			throw Error('No wallet api code supplied to the Blockchain service');
		}

		this.setupReceiver();
		this.setupWalletService();

		console.log(`Created Blockchain payment service`.yellow);
	}

	setupReceiver() {
		const xPub = this.config.xPub;
		const receiveApiCode = this.config.receiveApiCode;
		const callbackUrl = this.config.callbackUrl ? this.config.callbackUrl : 'http://0.0.0.0';

		this.receiver = new blockchain.Receive(xPub, callbackUrl, receiveApiCode);
	}

	setupWalletService() {
		this.walletService = new LocalWalletService({
			apiCode: this.config.walletApiCode
		});
	}


	getExchangeRates() {
		return blockchain.exchange.getTicker().catch(error => {
			throw {
				name: 'blockchain-exchange-rates',
				message: error
			};
		});
	}

	//
	// Encrypted payment
	// Goes to a central server that decrypts the credentials and performs the payment
	//
	makeEncryptedPayment(paymentData, amount/*, currency*/) {
		return new Promise((resolve, reject) => {
			const receiveAddress = this.config.receiveAddress;
			let url = this.config.serviceUrl;

			url += `/walletTsx?credentials=${encodeURIComponent(paymentData.credentials)}&tagId=${paymentData.tagId}&amount=${amount}&receiveAddress=${receiveAddress}`;

			console.log(url);

			request(url, (error, response, body) => {
				const parsed = JSON.parse(body);

				if (error || response.statusCode !== 200) {
					return reject(error || parsed);
				}

				resolve(parsed);
			});
		});
	}

	//
	// Unencrypted payment
	// Goes directly to payment service, credentials are cleartext
	//
	makePayment(paymentData, amountInBtc/*, currency*/) {

		const amountInSatoshi = BitcoinUtils.btcToSatoshi(amountInBtc);
		const credentials = {
			identifier: paymentData.username,
			password: paymentData.password
		};

		// körs mot hektorw.se
		return this.makePaymentThroughProxy(credentials, amountInBtc);

		// körs lokalt (whitelist IP!)
		/*return this.receiver.generate()
			.then(response => this.walletService.makePayment(credentials, response.address, amountInSatoshi));*/
	}


	makePaymentThroughProxy(paymentData, amountInBtc) {
		return new Promise((resolve, reject) => {
			const receiveAddress = this.config.xPub;
			// let url = this.config.serviceUrl;
			let url = this.config.callbackUrl;
			// let url = 'http://127.0.0.1:9000';

			url += `/unsafeTransaction?identifier=${encodeURIComponent(paymentData.identifier)}&password=${encodeURIComponent(paymentData.password)}&amount=${amountInBtc}&receiveAddress=${receiveAddress}`;

			request(url, (error, response, body) => {
				const parsed = JSON.parse(body);

				if (error || response.statusCode !== 200) {
					return reject(error || parsed);
				}

				resolve(parsed);
			});
		});
	}
};
