# homebridge-awair
Awair plugin for homebridge: https://github.com/nfarina/homebridge

This is a very basic plugin for Nfarina's wonderfull [Homebridge project](https://github.com/nfarina/homebridge). It will fetch current sensor conditions from an Awair or Awair Glow device and provide temperature, humidity, Carbon Dioxide, VOC, and dust information for HomeKit.

You can look at the current Awair information via HomeKit enabled Apps on your iOS device or even ask Siri for them.

It will get new data once every 5 minutes (default), but it can be customized in `config.json`.

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-awair
3. Update your configuration file. See the sample below.

You'll need to run a few HTTP requests to obtain your device ID(s) (`devId`).

1. 
2. 
3. 

You'll also need to gain access to and visit the [Awair developer dashboard](http://dashboard.awair.is/dashboard/devcon) to obtain your Organization Token (`orgToken`).

The [Awair API Documentation](http://docs.enterprise.awair.is/) explains the inner workings of the Awair API, but for the most part is not necessary to use this plugin.

# Configuration

Configuration sample:

Add the following information to your config file (note: shown with two example devices: Awair and Awair Glow).

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
	}
]
```

`orgToken`	=> Organization Token (REQUIRED, see Installation)
`devId` 	=> Device ID (REQUIRED, see Installation)
`devType`	=> Device Type (REQUIRED, either `awair` or `awair-glow`)
`serial`	=> Serial Number (default = `devType-devId`, optional)
`model`		=> `Awair` or `Awair Glow` (default = `devType`,optional)
`fetch`		=> The frequency (in minutes) that you would like to update the data in HomeKit (default = `5`, optional)