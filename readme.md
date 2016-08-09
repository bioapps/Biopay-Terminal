# Biopay-Terminal
Running the app requires a folder called "local-data" in the root directory with a file named "payment-services.json" which should contain data needed to run the app. 

payment-services.json
```
{
	"bitcoins": {
		"xPub": "A blockchain xPub address",
		"receiveApiCode": "Api code for blockchain receive api",
		"walletApiCode": "Api code for blockchain wallet api",
		"callbackUrl": "Public facing url for confirmation callbacks"
	}
}
```

Running the app will start up a server that host's the gui and expose an api for creating payments.

To run the app type the following.

```
npm start
```

## GUI
To run only gui without payment enabled type

```
npm run gui
```
