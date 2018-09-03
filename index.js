var Service, Characteristic;
var request = require("request-promise");

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	
	homebridge.registerAccessory("homebridge-awair", "Awair", Awair);
};

function Awair(log, config) {
	this.log = log;
	this.token = config["token"];
	this.manufacturer = config["manufacturer"] || "Awair";
	this.deviceType = config["deviceType"] || "awair";
	this.deviceId = config["deviceId"];
	this.serial = config['serial'] || devType + "-" + devId;
	this.carbonDioxideThreshold = config['carbonDioxideThreshold'] || 1000;
	this.polling_interval = Number(config["polling_interval"] || 1800); // Seconds, 15 mins
	this.url = config["url"] || "http://developer-apis.awair.is/v1/users/self/devices/" + this.deviceType + "/" + this.deviceId + "/air-data/latest";
}

Awair.prototype = {
	getData: function() {
		var options = {
			method: "GET",
			uri: this.url,
			json: true,
			headers: {
				Authorization: "Bearer " + this.token,
				"User-Agent": "Homebridge Plugin"
			}
		};
		
		var that = this;
		
		return request(options)
			.then(function(response) {
				var data = response.data[0];
				that.log("%d readings collected", data.length);
			
				that.airQualityService
					.setCharacteristic(Characteristic.AirQuality, that.convertScore(data.score));
				
				var sensors = data.sensors;
				
				for (sensor in sensors) {
					switch (sensors[sensor].comp) {
						case "temp":
							// Temperature (C)
							that.temperatureService
								.setCharacteristic(Characteristic.CurrentTemperature, sensors[sensor].value);
							break;
						case "humid":
							// Humidity (%)
							that.humidityService
								.setCharacteristic(Characteristic.CurrentRelativeHumidity, sensors[sensor].value);
							break;
						case "co2":
							// Carbon Dioxide (ppm)
							that.carbonDioxideService
								.setCharacteristic(Characteristic.CarbonDioxideLevel, sensors[sensor].value);
							if (sensors[sensor].value >= this.carbonDioxideThreshold) {
								that.carbonDioxideService
									.setCharacteristic(Characteristic.CarbonDioxideDetected);
							}
							break;
						case "voc":
							// Chemicals (ppb)
							that.airQualityService
								.setCharacteristic(Characteristic.VOCDensity, sensors[sensor].value);
							break;
						case "dust":
							// Dust (mcg/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM10Density, sensors[sensor].value);
							break;
						case "pm25":
							// PM2.5 (mcg/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM2_5Density, sensors[sensor].value);
							break;
						case "pm10":
							// PM10 (mcg/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM10Density, sensors[sensor].value);
							break;
						default:
							console.log("ignore: " + sensors[sensor].comp);
							break;
					}
				}
			})
				.catch(function(err) {
					that.log("Error contacting Awair API: " + err);
				});
	},
	
	convertScore: function(score) {
		var score = parseFloat(score);
		if (!score) {
			return 0; // Error
		} else if (score >= 90) {
			return 1; // EXCELLENT
		} else if (score >= 80 && score < 90) {
			return 2; // GOOD
		} else if (score >= 60 && score < 80) {
			return 3; // FAIR
		} else if (score >= 50 && score < 60) {
			return 4; // INFERIOR
		} else if (score < 50) {
			return 5; // POOR
		} else {
			return 0; // Error
		}
	},
	
	getServices: function() {
		var informationService = new Service.AccessoryInformation();
		var airQualityService = new Service.AirQualitySensor();
		var temperatureService = new Service.TemperatureSensor();
		var humidityService = new Service.HumiditySensor();
		var carbonDioxideService = new Service.CarbonDioxideSensor();
	
		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.deviceType)
			.setCharacteristic(Characteristic.SerialNumber, this.serial);
		
		airQualityService
			.setCharacteristic(Characteristic.AirQuality, "--")
			.setCharacteristic(Characteristic.VOCDensity, "--")
			.setCharacteristic(Characteristic.PM2_5Density, "--")
			.setCharacteristic(Characteristic.PM10Density, "--");
		
		temperatureService
			.setCharacteristic(Characteristic.CurrentTemperature, "--");
		
		humidityService
			.setCharacteristic(Characteristic.CurrentRelativeHumidity, "--");
		
		carbonDioxideService
			.setCharacteristic(Characteristic.CarbonDioxideLevel, "--");
		
		this.informationService = informationService;
		this.airQualityService = airQualityService;
		this.temperatureService = temperatureService;
		this.humidityService = humidityService;
		this.carbonDioxideService = carbonDioxideService;
		
		if (this.polling_interval > 0) {
			this.timer = setInterval(
				this.getData.bind(this),
				this.polling_interval * 1000
			);
		}
		
		// Get tnitial state
		this.getData().bind(this);
		
		return [
			informationService,
			airQualityService,
			temperatureService,
			humidityService,
			carbonDioxideService
		];
	}
};
