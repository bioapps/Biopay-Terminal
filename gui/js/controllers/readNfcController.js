/* globals io */
'use strict';

const $ = require('jquery');

const api = require('../utils/api');
const navigation = require('../utils/navigation');


const socket = io.connect();
socket.on('nfc.reading', () => {
	setUIState('reading');
});


function setUIState(state) {
	const $el = $('#read-nfc').find('.read-tag');
	const $header = $el.find('h2');

	$el.removeClass('ready reading payment');

	switch (state) {
		case 'ready':
			$el.addClass('ready');
			break;
		case 'reading':
			$el.addClass('reading');
			$header.html('Hold still');
			break;
		case 'payment':
			$el.addClass('payment');
			$header.html('Reading complete, processing payment.');
			break;
	}
}


module.exports = function($http, dataService) {
	const type = dataService.get('type');
	const amount = dataService.get('amount');
	const currency = dataService.get('currency');

	setUIState('ready');

	api.get($http, `nfc/${type}`)
		.then(res => {
			setUIState('payment');
			
			const paymentData = res.data;
			console.log('Read data from nfc chip', paymentData);

			return api.post($http, `payment/${type}`, {
				paymentData: JSON.stringify(paymentData),
				amount,
				currency
			});
		})
		.then(result => {
			console.log('Payment result', result);
			navigation.navigate('confirm');
		})
		.catch(error => {
			navigation.navigate('error', error.data);
		});
};