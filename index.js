var Service, Characteristic;
var request = require("request-promise");
const packageJSON = require("./package.json");

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	
	homebridge.registerAccessory("homebridge-awair", "Awair", Awair);
};

function Awair(log, config) {
	this.log = log;
	this.logging = config["logging"] || false;
	this.token = config["token"];
	this.manufacturer = config["manufacturer"] || "Awair";
	this.devType = config["devType"];
	this.devId = config["devId"];
	this.serial = config["serial"] || this.devType + "_" + this.devId;
	this.carbonDioxideThreshold = Number(config["carbonDioxideThreshold"]) || 0; // ppm, 0 = OFF
	this.carbonDioxideThresholdOff = Number(config["carbonDioxideThresholdOff"]) || Number(this.carbonDioxideThreshold); // ppm, same as carbonDioxideThreshold by default, should be less than or equal to carbonDioxideThreshold
	this.vocMW = Number(config["voc_mixture_mw"]) || 72.66578273019740; // Molecular Weight (g/mol) of a reference VOC gas or mixture
	this.airQualityMethod = config["air_quality_method"] || "awair-score"; // awair-score, awair-aqi
	this.userType = config["userType"] || "users/self"; // users/self, orgs/###
	this.polling_interval = Number(config["polling_interval"]) || 900; // seconds (default: 15 mins)
	this.limit = Number(config["limit"]) || 12; // consecutive 10 second
	this.endpoint = config["endpoint"] || "15-min-avg"; // 15-min-avg, 5-min-avg, raw, latest
	this.url = config["url"] || "https://developer-apis.awair.is/v1/" + this.userType + "/devices/" + this.devType + "/" + this.devId + "/air-data/" + this.endpoint + "?limit=" + this.limit + "&desc=true";
}

Awair.prototype = {
	getData: function() {
		var options = {
			method: "GET",
			uri: this.url,
			json: true,
			headers: {
				Authorization: "Bearer " + this.token
			}
		};
		
		if(this.logging){this.log("[" + this.serial + "] url: " + this.url)};
		
		var that = this;
		
		return request(options)
			.then(function(response) {
				var data = response.data;
				
				var sensors = data
					.map(sensor => sensor.sensors)
					.reduce((a, b) => a.concat(b))
					.reduce((a, b) => {a[b.comp] = a[b.comp] ? 0.5*(a[b.comp] + b.value) : b.value; return a}, {});
				
				var score = data.reduce((a, b) => {return a + b.score}, 0) / data.length;
				
				if (that.airQualityMethod == 'awair-aqi') {
					that.airQualityService
					.setCharacteristic(Characteristic.AirQuality, that.convertAwairAqi(sensors));
				} else {
					that.airQualityService
					.setCharacteristic(Characteristic.AirQuality, that.convertScore(score));
				}
				
				that.airQualityService.isPrimaryService = true;
				if (that.devType == "awair-mint") {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService, that.lightLevelService];
				} else if (that.devType == "awair-glow-c") {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService];
				} else if (that.devType == "awair-omni") {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService, that.carbonDioxideService, that.lightLevelService];
				} else {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService, that.carbonDioxideService];
				}
				
				var temp = parseFloat(sensors.temp);
				var atmos = 1;
				
				if(that.logging){that.log("[" + that.serial + "] " + that.endpoint + ": " + JSON.stringify(sensors) + ", score: " + score)};
				
				for (var sensor in sensors) {
					switch (sensor) {
						case "temp":
							// Temperature (C)
							that.temperatureService
								.setCharacteristic(Characteristic.CurrentTemperature, parseFloat(sensors[sensor]))
							break;
						case "humid":
							// Humidity (%)
							that.humidityService
								.setCharacteristic(Characteristic.CurrentRelativeHumidity, parseFloat(sensors[sensor]))
							break;
						case "co2":
							// Carbon Dioxide (ppm)
							var co2 = sensors[sensor];
							var co2Detected;
							
							var co2Before = that.carbonDioxideService.getCharacteristic(Characteristic.CarbonDioxideDetected).value;
							if(that.logging){that.log("[" + that.serial + "] CO2Before: " + co2Before)};
							
							// Logic to determine if Carbon Dioxide should trip a change in Detected state
							that.carbonDioxideService
								.setCharacteristic(Characteristic.CarbonDioxideLevel, parseFloat(sensors[sensor]))
							if ((that.carbonDioxideThreshold > 0) && (co2 >= that.carbonDioxideThreshold)) {
								// threshold set and CO2 HIGH
								co2Detected = 1;
								if(that.logging){that.log("[" + that.serial + "] CO2 HIGH: " + co2 + " > " + that.carbonDioxideThreshold)};
							} else if ((that.carbonDioxideThreshold > 0) && (co2 < that.carbonDioxideThresholdOff)) {
								// threshold set and CO2 LOW
								co2Detected = 0;
								if(that.logging){that.log("[" + that.serial + "] CO2 NORMAL: " + co2 + " < " + that.carbonDioxideThresholdOff)};
							} else if ((that.carbonDioxideThreshold > 0) && (co2 < that.carbonDioxideThreshold) && (co2 > that.carbonDioxideThresholdOff)) {
								// the inbetween...
								if(that.logging){that.log("[" + that.serial + "] CO2 INBETWEEN: " + that.carbonDioxideThreshold + " > [[[" + co2 + "]]] > " + that.carbonDioxideThresholdOff)};
								co2Detected = co2Before;
							} else {
								// threshold NOT set
								co2Detected = 0;
								if(that.logging){that.log("[" + that.serial + "] CO2: " + co2)};
							}
							
							// Prevent sending a Carbon Dioxide detected update if one has not occured
							if ((co2Before == 0) && (co2Detected == 0)) {
								// CO2 low already, don't send
								if(that.logging){that.log("Carbon Dioxide already low.")};
							} else if ((co2Before == 0) && (co2Detected == 1)) {
								// CO2 low to high, send it!
								that.carbonDioxideService.setCharacteristic(Characteristic.CarbonDioxideDetected, co2Detected);
								if(that.logging){that.log("Carbon Dioxide low to high.")};
							} else if ((co2Before == 1) && (co2Detected == 1)) {
								// CO2 high to not-quite-low-enough-yet, don't send
								if(that.logging){that.log("Carbon Dioxide already elevated.")};
							} else if ((co2Before == 1) && (co2Detected == 0)) {
								// CO2 low to high, send it!
								that.carbonDioxideService.setCharacteristic(Characteristic.CarbonDioxideDetected, co2Detected);
								if(that.logging){that.log("Carbon Dioxide high to low.")};
							} else {
								// CO2 unknown...
								if(that.logging){that.log("Carbon Dioxide state unknown.")};
							}
							break;
						case "voc":
							var voc = parseFloat(sensors[sensor]);
							var tvoc = that.convertChemicals(voc, atmos, temp);
							if(that.logging){that.log("[" + that.serial + "]: voc (" + voc + " ppb) => tvoc (" + tvoc + " ug/m^3)")};
							// Chemicals (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.VOCDensity, tvoc);
							break;
						case "dust":
							// Dust (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM10Density, parseFloat(sensors[sensor]));
							break;
						case "pm25":
							// PM2.5 (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM2_5Density, parseFloat(sensors[sensor]));
							break;
						case "pm10":
							// PM10 (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM10Density, parseFloat(sensors[sensor]));
							break;
						case "lux":
							// Light (lux)
							that.lightLevelService
								.setCharacteristic(Characteristic.CurrentAmbientLightLevel, parseFloat(sensors[sensor]));
							break;
						case "spl_a":
							// Sound (dBA)
							// TODO: replace with a HomeKit service
							if(that.logging){that.log("[" + that.serial + "] ignoring " + JSON.stringify(sensor) + ": " + parseFloat(sensors[sensor]))};
							break;
						default:
							if(that.logging){that.log("[" + that.serial + "] ignoring " + JSON.stringify(sensor) + ": " + parseFloat(sensors[sensor]))};
							break;
					}
				}
			})
			.catch(function(err) {
				if(that.logging){that.log("[" + that.serial + "] " + err)};
				that.temperatureService
					.setCharacteristic(Characteristic.CurrentTemperature, "--")
				that.humidityService
					.setCharacteristic(Characteristic.CurrentRelativeHumidity, "--")
				if (that.devType != "awair-mint" && that.devType != "awair-glow-c") {
					that.carbonDioxideService
						.setCharacteristic(Characteristic.CarbonDioxideLevel, "--")
				};
				if (that.devType == "awair-omni" || that.devType == "awair-mint") {
					that.lightLevelService
						.setCharacteristic(Characteristic.CurrentAmbientLightLevel, "--")
				};
				that.airQualityService
					.setCharacteristic(Characteristic.AirQuality, "--")
					.setCharacteristic(Characteristic.VOCDensity, "--")
					.setCharacteristic(Characteristic.PM10Density, "--")
					.setCharacteristic(Characteristic.PM2_5Density, "--")
			});
	},
	
	convertChemicals: function(voc, atmos, temp) {
		var that = this;
		var mw = parseFloat(that.vocMW);
		var voc = parseFloat(voc);
		var atmos = parseFloat(atmos);
		var temp = parseFloat(temp);
		var vocString = "(" + voc + " * " + mw + " * " + atmos + " * 101.32) / ((273.15 + " + temp + ") * 8.3144)";
		var tvoc = (voc * mw * atmos * 101.32) / ((273.15 + temp) * 8.3144);
		if(that.logging){that.log("[" + that.serial + "] ppb => ug/m^3 equation: " + vocString)};
		return tvoc;
	},
	
	convertScore: function(score) {
		var that = this;
		var score = parseFloat(score);
		if (score >= 90) {
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
	
	convertAwairAqi: function(sensors) {
		var that = this;
		var aqiArray = [];
		var sensors = sensors;
		for (var sensor in sensors) {
			switch (sensor) {
				case "voc":
					var aqiVoc = parseFloat(sensors[sensor]);
					if (aqiVoc >= 0 && aqiVoc < 333) {
						aqiVoc = 1; // EXCELLENT
					} else if (aqiVoc >= 333 && aqiVoc < 1000) {
						aqiVoc = 2; // GOOD
					} else if (aqiVoc >= 1000 && aqiVoc < 3333) {
						aqiVoc = 3; // FAIR
					} else if (aqiVoc >= 3333 && aqiVoc < 8332) {
						aqiVoc = 4; // INFERIOR
					} else if (aqiVoc >= 8332) {
						aqiVoc = 5; // POOR
					} else {
						aqiVoc = 0; // Error
					}
					aqiArray.push(aqiVoc);
					break;
				case "pm25":
					var aqiPm25 = parseFloat(sensors[sensor]);
					if (aqiPm25 >= 0 && aqiPm25 < 15) {
						aqiPm25 = 1; // EXCELLENT
					} else if (aqiPm25 >= 15 && aqiPm25 < 35) {
						aqiPm25 = 2; // GOOD
					} else if (aqiPm25 >= 35 && aqiPm25 < 55) {
						aqiPm25 = 3; // FAIR
					} else if (aqiPm25 >= 55 && aqiPm25 < 75) {
						aqiPm25 = 4; // INFERIOR
					} else if (aqiPm25 >= 75) {
						aqiPm25 = 5; // POOR
					} else {
						aqiPm25 = 0; // Error
					}
					aqiArray.push(aqiPm25);
					break;
				case "dust":
					var aqiDust = parseFloat(sensors[sensor]);
					if (aqiDust >= 0 && aqiDust < 50) {
						aqiDust = 1; // EXCELLENT
					} else if (aqiDust >= 100 && aqiDust < 50) {
						aqiDust = 2; // GOOD
					} else if (aqiDust >= 150 && aqiDust < 100) {
						aqiDust = 3; // FAIR
					} else if (aqiDust >= 250 && aqiDust < 150) {
						aqiDust = 4; // INFERIOR
					} else if (aqiDust >= 250) {
						aqiDust = 5; // POOR
					} else {
						aqiDust = 0; // Error
					}
					aqiArray.push(aqiDust);
					break;
				default:
					if(that.logging){that.log("[" + that.serial + "] ignoring " + JSON.stringify(sensor) + ": " + parseFloat(sensors[sensor]))};
					aqiArray.push(0);
					break;
			}
		}
		if(that.logging){that.log("[" + that.serial + "] array: " + JSON.stringify(aqiArray))};
		return Math.max(...aqiArray);
	},
	
	getServices: function() {
		var services = [];
		
		var informationService = new Service.AccessoryInformation();
		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.devType)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)
			.setCharacteristic(Characteristic.FirmwareRevision, packageJSON.version);
		this.informationService = informationService;
		services.push(informationService);
		
		var airQualityService = new Service.AirQualitySensor();
		if (this.devType == "awair-glow" || this.devType == "awair-glow-c") {
			airQualityService
				.setCharacteristic(Characteristic.AirQuality, "--")
				.setCharacteristic(Characteristic.VOCDensity, "--")
		} else if (this.devType == "awair") {
			airQualityService
				.setCharacteristic(Characteristic.AirQuality, "--")
				.setCharacteristic(Characteristic.VOCDensity, "--")
				.setCharacteristic(Characteristic.PM10Density, "--")
		} else { // mint, omni, awair-r2, element
			airQualityService
				.setCharacteristic(Characteristic.AirQuality, "--")
				.setCharacteristic(Characteristic.VOCDensity, "--")
				.setCharacteristic(Characteristic.PM2_5Density, "--");
		}
		airQualityService
			.getCharacteristic(Characteristic.VOCDensity)
			.setProps({
				minValue: 0,
				maxValue: 100000
			});
		this.airQualityService = airQualityService;
		services.push(airQualityService);
		
		var temperatureService = new Service.TemperatureSensor();
		temperatureService
			.setCharacteristic(Characteristic.CurrentTemperature, "--");
		temperatureService
			.getCharacteristic(Characteristic.CurrentTemperature)
			.setProps({
				minValue: -100,
				maxValue: 100
			});
		this.temperatureService = temperatureService;
		services.push(temperatureService);
		
		var humidityService = new Service.HumiditySensor();
		humidityService
			.setCharacteristic(Characteristic.CurrentRelativeHumidity, "--");
		this.humidityService = humidityService;
		services.push(humidityService);
		
		if (this.devType != "awair-mint" && this.devType != "awair-glow-c") {
			var carbonDioxideService = new Service.CarbonDioxideSensor();
			carbonDioxideService
				.setCharacteristic(Characteristic.CarbonDioxideLevel, "--");
			this.carbonDioxideService = carbonDioxideService;
			services.push(carbonDioxideService);
		}
		
		if (this.devType == "awair-omni" || this.devType == "awair-mint") {
			var lightLevelService = new Service.LightSensor();
			lightLevelService
				.setCharacteristic(Characteristic.CurrentAmbientLightLevel, "--");
			lightLevelService
				.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
				.setProps({
					minValue: 0,
					maxValue: 64000
				});
			this.lightLevelService = lightLevelService;
			services.push(lightLevelService);
		}
		
		if (this.polling_interval > 0) {
			this.timer = setInterval(
				this.getData.bind(this),
				this.polling_interval * 1000
			);
		}
		
		// Get tnitial state
		this.getData().bind(this);
		
		return services;
	}
};
