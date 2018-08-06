# homebridge-awair
Awair plugin for homebridge: https://github.com/nfarina/homebridge

This is a very basic plugin for Nfarina's amazing [Homebridge project](https://github.com/nfarina/homebridge). It will fetch current sensor conditions from an Awair device (e.g. Awair, Awair Glow, Awair Mint, Awair Omni, or Awair 2nd Edition) and provide available sensor readings (e.g. temperature, humidity, carbon dioxide, TVOC, and dust/PM2.5/PM10) information for HomeKit.

You can look at the current Awair information via HomeKit enabled Apps on your iOS device or even ask Siri for them.

It will get new data once every 15 minutes (default), but it can be customized in `config.json`.

# Installation

1. Install homebridge using: `npm install -g homebridge` or `sudo npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-awair` or `sudo npm install -g homebridge-awair`
3. Update your configuration file. See the sample below.

You'll need to run an HTTP request to obtain each Awair's device ID (`devId`) and device type (`devType`).

```
curl -X GET \
http://developer-apis.awair.is/v1/users/self/devices \
-H 'Authorization: Bearer {developer-token}'
```

You'll also need to request access to the [Awair Developer Console](https://developer.getawair.com) to obtain your Developer Token (`token`).

The [Awair Developer API Documentation](https://docs.developer.getawair.com) explains the inner workings of the Awair Developer API, but for the most part is not necessary to use this plugin.

# Configuration

Configuration sample:

Add the following information to your config file (note: shown with (5) example devices: Awair, Awair Glow, Awair Mint, Awair Omni, and Awair 2nd Edition).

```
"accessories": [
	{
		"accessory": "Awair",
		"name": "Example Room 1 Awair",
		"token": "AAA.AAA.AAA",
		"devType": "awair",
		"devId": 123,
		"serial": "example-serial-123",
		"model": "Awair",
		"carbonDioxideThreshold": 1200,
		"polling": 15
	},{
		"accessory": "Awair",
		"name": "Example Room 2 Awair Glow",
		"token": "AAA.AAA.AAA",
		"devType": "awair-glow",
		"devId": 124,
		"serial": "example-serial-124",
		"model": "Awair Glow",
		"carbonDioxideThreshold": 1200,
		"polling": 15
	},{
		"accessory": "Awair",
		"name": "Example Room 3 Awair Mint",
		"token": "AAA.AAA.AAA",
		"devType": "awair-mint",
		"devId": 125,
		"serial": "example-serial-125",
		"model": "Awair Mint",
		"polling": 15
	},{
		"accessory": "Awair",
		"name": "Example Room 4 Awair Omni",
		"token": "AAA.AAA.AAA",
		"devType": "awair-omni",
		"devId": 126,
		"serial": "example-serial-126",
		"model": "Awair Omni",
		"carbonDioxideThreshold": 1200,
		"polling": 15
	},{
		"accessory": "Awair",
		"name": "Example Room 5 Awair 2nd Edition",
		"token": "AAA.AAA.AAA",
		"devType": "awair-r2",
		"devId": 127,
		"serial": "example-serial-127",
		"model": "Awair 2nd Edition",
		"carbonDioxideThreshold": 1200,
		"polling": 15
	}
]
```

`token`						=> Developer Token (REQUIRED, see [Installation](#installation))
`devType`					=> Device Type (REQUIRED, options: `awair`, `awair-glow`, `awair-mint`, `awair-omni`, or `awair-r2`)
`devId` 					=> Device ID (REQUIRED, see Installation)
`serial`					=> Serial Number (OPTIONAL, default = `devType-devId`, options: `mac-address` or `devType-devId`)
`model`						=> Device Model (OPTIONAL, default = `devType`, options: `Awair`, `Awair Glow`, `Awair Mint`, `Awair Omni`, `Awair 2nd Edition`)
`carbonDioxideThreshold`	=> (OPTIONAL, default = `0` [i.e. OFF], the level at which HomeKit will trigger an alert for the CO2 in ppm)
`polling`					=> The frequency (OPTIONAL, default = `15`, units: minutes, that you would like to update the data in HomeKit)