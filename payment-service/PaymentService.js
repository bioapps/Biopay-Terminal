'use strict';

const BlockchainService = require('./blockchain/BlockchainService');
const _  = require('lodash');

const baseConfig = {
	bitcoins: null
};

module.exports = class PaymentService {
	constructor(config) {
		config = Object.assign({}, baseConfig, config);

		this.setupPaymentServices(config);
	}

	setupPaymentServices(config) {
		this.paymentServices = {
			bitcoins: new BlockchainService(config.bitcoins)
		};
	}

	getSupportedPaymentServices() {
		return _.map(this.paymentServices, (__, name) => {
			return {
				type: name,
				name: name
			};
		});
	}

	isPaymentTypeSupported(type) {
		return !!this.paymentServices[type];
	}


	getExchangeRates() {
		let service = this.paymentServices.bitcoins;

		if (!service) {
			throw Error('Unsupported payment type passed in to getExchangeRates');		
		}

		return service.getExchangeRates(); 
	}


	makePayment(type, paymentData, amount, currency) {
		let service = this.paymentServices[type];

		if (!service) {
			throw Error('Unsupported payment type passed in to makePayment');		
		}

		return service.makePayment(paymentData, amount, currency);
	}
};
