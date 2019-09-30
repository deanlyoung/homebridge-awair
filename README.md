# homebridge-awair
Awair plugin for homebridge: https://github.com/nfarina/homebridge

Based on the great work of [@henrypoydar](https://github.com/henrypoydar).

This is a very basic plugin for Nfarina's amazing [Homebridge project](https://github.com/nfarina/homebridge). It will fetch current sensor conditions from an Awair device (e.g. Awair, Awair Glow, Awair Mint, Awair Omni, or Awair 2nd Edition) and provide available sensor readings (e.g. temperature, humidity, carbon dioxide, TVOC, and dust/PM2.5/PM10) information for HomeKit.

You can look at the current Awair information via HomeKit enabled Apps on your iOS device or even ask Siri for them.

It will get new data once every 15 minutes (default), but it can be customized in `config.json`.

# Installation

1. Install homebridge using: `[sudo] npm install -g homebridge`
2. Install this plugin using: `[sudo] npm install -g homebridge-awair`
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

See [config-sample.json](https://github.com/deanlyoung/homebridge-awair/blob/master/config-sample.json)


```
"accessories": [
	{
		"accessory": "Awair",
		"name": "Example Room 1 Awair",
		"token": "AAA.AAA.AAA",
		"manufacturer": "Awair",
		"devType": "awair",
		"devId": "123",
		"serial": "example-serial_123",
		"model": "Awair",
		"carbonDioxideThreshold": 1200,
		"carbonDioxideThresholdOff": 1200,
		"voc_mixture_mw": 72.66578273019740,
		"air_quality_method": "awair-score",
		"userType": "users/self",
		"endpoint": "15-min-avg",
		"polling_interval": 900,
		"limit": 12
	},{
		"accessory": "Awair",
		"name": "Example Room 2 Awair Glow",
		"token": "AAA.AAA.AAA",
		"manufacturer": "Awair",
		"devType": "awair-glow",
		"devId": "124",
		"serial": "example-serial_124",
		"model": "Awair Glow",
		"carbonDioxideThreshold": 1200,
		"carbonDioxideThresholdOff": 900,
		"voc_mixture_mw": 72.66578273019740,
		"air_quality_method": "awair-score",
		"userType": "users/self",
		"endpoint": "15-min-avg",
		"polling_interval": 900,
		"limit": 12
	},{
		"accessory": "Awair",
		"name": "Example Room 3 Awair Mint",
		"token": "AAA.AAA.AAA",
		"manufacturer": "Awair",
		"devType": "awair-mint",
		"devId": "125",
		"serial": "example-serial_125",
		"model": "Awair Mint",
		"carbonDioxideThreshold": 0,
		"carbonDioxideThresholdOff": 0,
		"voc_mixture_mw": 72.66578273019740,
		"air_quality_method": "awair-score",
		"userType": "users/self",
		"endpoint": "15-min-avg",
		"polling_interval": 900,
		"limit": 12
	},{
		"accessory": "Awair",
		"name": "Example Room 4 Awair Omni",
		"token": "AAA.AAA.AAA",
		"manufacturer": "Awair",
		"devType": "awair-omni",
		"devId": "126",
		"serial": "example-serial_126",
		"model": "Awair Omni",
		"carbonDioxideThreshold": 1200,
		"carbonDioxideThresholdOff": 800,
		"voc_mixture_mw": 72.66578273019740,
		"air_quality_method": "awair-score",
		"userType": "users/self",
		"endpoint": "15-min-avg",
		"polling_interval": 900,
		"limit": 12
	},{
		"accessory": "Awair",
		"name": "Example Room 5 Awair 2nd Edition",
		"token": "AAA.AAA.AAA",
		"manufacturer": "Awair",
		"devType": "awair-r2",
		"devId": "127",
		"serial": "example-serial_127",
		"model": "Awair 2nd Edition",
		"carbonDioxideThreshold": 1200,
		"carbonDioxideThresholdOff": 1000,
		"voc_mixture_mw": 72.66578273019740,
		"air_quality_method": "awair-score",
		"userType": "users/self",
		"endpoint": "15-min-avg",
		"polling_interval": 900,
		"limit": 12
	}
]
```

## Descriptions
```
	     `accessory`	=> The Homebridge Accessory (REQUIRED, must be exactly: `Awair`)
		  `name`	=> The accessory name that appears by default in HomeKit (REQUIRED, can be anything)
		 `token`	=> Developer Token (REQUIRED, see [Installation](#installation))
	  `manufacturer`	=> Manufacturer (OPTIONAL, default = `Awair`)
	       `devType`	=> Device Type (REQUIRED, options: `awair`, `awair-glow`, `awair-mint`, `awair-omni`, or `awair-r2`)
		 `devId`	=> Device ID (REQUIRED, see [Installation](#installation))
		`serial`	=> Serial Number (OPTIONAL, default = `devType_devId`, options: `mac-address` or `devType_devId`)
		 `model`	=> Device Model (OPTIONAL, default = `devType`, options: `Awair`, `Awair Glow`, `Awair Mint`, `Awair Omni`, `Awair 2nd Edition`)
`carbonDioxideThreshold`	=> (OPTIONAL, default = `0` [i.e. OFF], the level at which HomeKit will trigger an alert for the CO2 in ppm)
`carbonDioxideThresholdOff`	=> (OPTIONAL, default = `0` [i.e. `carbonDioxideThreshold`], the level at which HomeKit will turn off the trigger alert for the CO2 in ppm, to ensure that it doesn't trigger on/off too frequently choose a number lower than `carbonDioxideThreshold`)
	`voc_mixture_mw`	=> The Molecular Weight (g/mol) of a reference gas or mixture that you use to convert from ppb to ug/m^3 (OPTIONAL, default = `72.66578273019740`)
    `air_quality_method`	=> Air quality calculation method used to define the Air Quality Chracteristic (OPTIONAL, default = `awair-score`, options: `awair-score`, `aqi`, `nowcast-aqi`)
	      `endpoint`	=> The `/air-data` endpoint to use (OPTIONAL, default = `15-min-avg`, options: `15-min-avg`, `5-min-avg`, `raw`, or `latest`)
	       `polling`	=> The frequency (OPTIONAL, default = `900` (15 minutes), units: seconds, that you would like to update the data in HomeKit)
	      `userType`	=> The type of user account (OPTIONAL, default = `users/self`, options: `users/self` or `orgs/###`, where ### is the Awair Organization `orgId`)
		 `limit`	=> Number of consecutive 10 second data points returned per request, used for custom averaging of sensor values from `/raw` endpoint (OPTIONAL, default = `12` i.e. 2 minute average)
		   `url`	=> The Awair url to poll (OPTIONAL, default = `http://developer-apis.awair.is/v1/users/self/devices/:device_type/:device_id/air-data/:endpoint?limit=:limit&desc=true`, EDITING NOT RECOMMENDED)
	       `logging`	=> Whether to output logs to the Homebridge logs (OPTIONAL, default = `false`)
```

# API Response

See response.sample.json

# Resources

- Awair API: https://docs.developer.getawair.com/
- Homebridge: https://github.com/nfarina/homebridge
- Homebridge plugin development: http://blog.theodo.fr/2017/08/make-siri-perfect-home-companion-devices-not-supported-apple-homekit/
- List of Services and conventions: https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js
- Another Awair plugin: https://github.com/henrypoydar/homebridge-awair-glow
- Reference AQ plugin: https://github.com/toto/homebridge-airrohr
- Refenerce temperature plugin: https://github.com/metbosch/homebridge-http-temperature
- AQI Calculation NPM package: https://www.npmjs.com/package/aqi-bot
