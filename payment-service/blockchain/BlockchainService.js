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
	makePayment(paymentData, amount/*, currency*/) {
		const amountInSatoshi = BitcoinUtils.btcToSatoshi(amount);

		const identifier = paymentData.username;
		const password = paymentData.password;

		const wallet = new blockchain.MyWallet(identifier, password, {
			apiCode: this.config.walletApiCode,
			apiHost: this.config.apiV2HostUrl
		});

		this.fixMyWalletParamsHack(wallet);

		return Promise.all([
				this.receiver.generate(),	// eslint-disable-line indent
				wallet.login()				// eslint-disable-line indent
			])								// eslint-disable-line indent
			.then(values => {
				const generatedAddress = values[0].address;
				
				console.log(`Making a new payment (BTC ${amount}) to (Address ${generatedAddress})`);
				return wallet.send(generatedAddress, amountInSatoshi);
			})
			.then(paymentResponse => {
				//
				// Should log out wallet
				//
				return paymentResponse;
			})
			.catch(error => {
				if (typeof error === 'string') {
					try {
						error = JSON.parse(error);
					} catch (ex) {}	// eslint-disable-line no-empty
				}

				throw {
					name: 'blockchain-payment',
					message: error
				};
			});
	}

	//
	// Last version checked where this fix is needed: "blockchain.info": "2.2.0"
	// 
	// MyWallet implementation sets the query parameter name for receiving addres as "address" but the API expects the query parameter name "to".
	// The MyWallet has a function called "getParams" which returns an object that the query parameters are added to.
	// We override this function and add a getter with the name "to" to the returned object that returns the value of "address".
	//
	fixMyWalletParamsHack(wallet) {
		const _getParams = wallet.getParams.bind(wallet);

		wallet.getParams = () => {
			const params = _getParams();

			Object.defineProperty(params, 'to', {
				enumerable: true,
				configurable: true,
				get() {
					return this.address;
				},
				set(value) {
					// If the "to" value is ever set, we remove our implementation and make it a regular property.
					delete this.to;
					this.to = value;
				}
			});

			return params;
		};
	}
};
