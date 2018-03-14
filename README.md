# homebridge-awair
Awair plugin for homebridge: https://github.com/nfarina/homebridge

This is a very basic plugin for Nfarina's amazing [Homebridge project](https://github.com/nfarina/homebridge). It will fetch current sensor conditions from an Awair or Awair Glow device and provide temperature, humidity, carbon dioxide, TVOC, and dust/PM2.5 information for HomeKit.

You can look at the current Awair information via HomeKit enabled Apps on your iOS device or even ask Siri for them.

It will get new data once every 5 minutes (default), but it can be customized in `config.json`.

# Installation

1. Install homebridge using: `npm install -g homebridge` or `sudo npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-awair` or `sudo npm install -g homebridge-awair`
3. Update your configuration file. See the sample below.

You'll need to run an HTTP request to obtain each Awair's device ID (`devId`) and device type (`devType`).

```
curl -X GET \
https://afb.awair.is/v1/orgs/self/devices \
-H 'Authorization: Bearer {developer-token}'
```

You'll also need to gain access to and visit the [Awair developer dashboard](https://dashboard.getawair.com) to obtain your Organization Token (`orgToken`).

The [Awair API Documentation](http://docs.afb.awair.is/) explains the inner workings of the Awair API, but for the most part is not necessary to use this plugin.

# Configuration

Configuration sample:

Add the following information to your config file (note: shown with four example devices: Awair, Awair Glow, Awair Mint, and Awair Omni).

```
"accessories": [
	{
		"accessory": "Awair",
		"name": "Example Room 1 Awair",
		"orgToken": "AAA.AAA.AAA",
		"devId": 123,
		"devType": "awair",
		"serial": "example-serial-123",
		"model": "Awair",
		"fetch": 5
	},{
		"accessory": "Awair",
		"name": "Example Room 2 Awair Glow",
		"orgToken": "AAA.AAA.AAA",
		"devId": 124,
		"devType": "awair-glow",
		"serial": "example-serial-124",
		"model": "Awair Glow",
		"fetch": 5
	},{
		"accessory": "Awair",
		"name": "Example Room 3 Awair Mint",
		"orgToken": "AAA.AAA.AAA",
		"devId": 125,
		"devType": "awair-mint",
		"serial": "example-serial-125",
		"model": "Awair Mint",
		"fetch": 5
	},{
		"accessory": "Awair",
		"name": "Example Room 4 Awair Omni",
		"orgToken": "AAA.AAA.AAA",
		"devId": 126,
		"devType": "awair-omni",
		"serial": "example-serial-126",
		"model": "Awair Omni",
		"fetch": 5
	}
]
```

`orgToken`	=> Organization Token (REQUIRED, see Installation)
`devId` 	=> Device ID (REQUIRED, see Installation)
`devType`	=> Device Type (REQUIRED, options: `awair`, `awair-glow`, `awair-mint`, or `awair-omni`)
`serial`	=> Serial Number (default = `devType-devId`, optional)
`model`		=> `Awair` or `Awair Glow` (default = `devType`,optional)
`fetch`		=> The frequency (in minutes) that you would like to update the data in HomeKit (default = `5`, optional)
