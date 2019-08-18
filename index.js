var Service, Characteristic;
var request = require("request-promise");
const packageJSON = require("./package.json");
let aqibot = require("aqi-bot");

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
	this.carbonDioxideThreshold = Number(config["carbonDioxideThreshold"] || 0); // ppm, 0 = OFF
	this.vocMW = Number(config["voc_mixture_mw"] || 72.66578273019740); // Molecular Weight (g/mol) of a reference VOC gas or mixture
	this.airQualityMethod = config["air_quality_method"] || "awair-score"; // awair-score, aqi, nowcast-aqi
	this.userType = config["userType"] || "users/self"; // users/self, orgs/###
	this.polling_interval = Number(config["polling_interval"] || 900); // seconds (15 mins)
	this.limit = Number(config["limit"] || 12); // consecutive 10 second
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
				
				that.airQualityService
					.setCharacteristic(Characteristic.AirQuality, that.convertScore(score));
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
								.setCharacteristic(Characteristic.StatusFault, 0);
							break;
						case "humid":
							// Humidity (%)
							that.humidityService
								.setCharacteristic(Characteristic.CurrentRelativeHumidity, parseFloat(sensors[sensor]))
								.setCharacteristic(Characteristic.StatusFault, 0);
							break;
						case "co2":
							// Carbon Dioxide (ppm)
							var co2 = sensors[sensor];
							var co2Detected;
							that.carbonDioxideService
								.setCharacteristic(Characteristic.CarbonDioxideLevel, parseFloat(sensors[sensor]))
								.setCharacteristic(Characteristic.StatusFault, 0);
							if ((that.carbonDioxideThreshold > 0) && (co2 >= that.carbonDioxideThreshold)) {
								co2Detected = 1;
								if(that.logging){that.log("[" + that.serial + "] CO2 HIGH: " + co2 + " > " + that.carbonDioxideThreshold)};
							} else {
								co2Detected = 0;
								if(that.logging){that.log("[" + that.serial + "] CO2 NORMAL: " + co2 + " < " + that.carbonDioxideThreshold)};
							}
							that.carbonDioxideService.setCharacteristic(Characteristic.CarbonDioxideDetected, co2Detected);
							break;
						case "voc":
							var voc = parseFloat(sensors[sensor]);
							tvoc = that.convertChemicals(voc, atmos, temp);
							if(that.logging){that.log("[" + that.serial + "]: voc (" + voc + " ppb) => tvoc (" + tvoc + " ug/m^3)")};
							// Chemicals (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.VOCDensity, tvoc)
								.setCharacteristic(Characteristic.StatusFault, 0);
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
								.setCharacteristic(Characteristic.StatusFault, 0);
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
					.setCharacteristic(Characteristic.StatusFault, 1);
				that.humidityService
					.setCharacteristic(Characteristic.CurrentRelativeHumidity, "--")
					.setCharacteristic(Characteristic.StatusFault, 1);
				if (that.devType != "awair-mint" && that.devType != "awair-glow-c") {
					that.carbonDioxideService
						.setCharacteristic(Characteristic.CarbonDioxideLevel, "--")
						.setCharacteristic(Characteristic.StatusFault, 1);
				};
				if (that.devType == "awair-omni" || that.devType == "awair-mint") {
					that.lightLevelService
						.setCharacteristic(Characteristic.CurrentAmbientLightLevel, "--")
						.setCharacteristic(Characteristic.StatusFault, 1);
				};
				that.airQualityService
					.setCharacteristic(Characteristic.AirQuality, "--")
					.setCharacteristic(Characteristic.VOCDensity, "--")
					.setCharacteristic(Characteristic.PM10Density, "--")
					.setCharacteristic(Characteristic.PM2_5Density, "--")
					.setCharacteristic(Characteristic.StatusFault, 1);
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
		var method = that.airQualityMethod;
		
		switch (method) {
			case "awair-score":
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
				break;
			case "aqi":
				var aqurl = "https://developer-apis.awair.is/v1/" + that.userType + "/devices/" + that.devType + "/" + that.devId + "/air-data/latest";
				if(that.logging){that.log(aqurl)};
				
				var aqoptions = {
					method: "GET",
					uri: aqurl,
					json: true,
					headers: {
						Authorization: "Bearer " + that.token
					}
				};
				
				return request(aqoptions)
					.then(function(response) {
						var aqtemp,
							pm25,
							pm10,
							voc,
							aqi;
						
						var aqatmos = 1;
						
						var aqdata = response.data;
						var aqsensors = aqdata
							.map(aqsensor => aqsensor.sensors)
							.reduce((a, b) => a.concat(b))
							.reduce((a, b) => {a[b.comp] = a[b.comp] ? 0.5*(a[b.comp] + b.value) : b.value; return a}, {});
						
						aqtemp = parseFloat(aqsensors.temp);
						
						for (var aqsensor in aqsensors) {
							switch (aqsensor) {
								case "voc":
									// Chemicals (ug/m^3)
									var aqvoc = parseFloat(aqsensors[aqsensor]);
									var aqtvoc = that.convertChemicals(aqvoc, aqatmos, aqtemp);
									if(that.logging){that.log(aqtvoc)};
									aqtvoc = parseFloat(aqtvoc);
									aqibot.AQICalculator.getAQIResult("CO", aqtvoc).then((result) => {
										if(that.logging){that.log(JSON.stringify(result))};
										voc = result.aqi;
										if(that.logging){that.log("voc: " + voc)};
									}).catch(err => {
										if(that.logging){that.log("voc: " + err)};
									})
									break;
								case "dust":
									// Dust (ug/m^3)
									var dusty = parseFloat(aqsensors[aqsensor]);
									aqibot.AQICalculator.getAQIResult("PM10", dusty).then((result) => {
										if(that.logging){that.log(JSON.stringify(result))};
										pm10 = result.aqi;
										if(that.logging){that.log("dust: " + pm10)};
									}).catch(err => {
										if(that.logging){that.log("dust: " + err)};
									})
									break;
								case "pm25":
									// PM2.5 (ug/m^3)
									var pm25y = parseFloat(aqsensors[aqsensor]);
									aqibot.AQICalculator.getAQIResult("PM2.5", pm25y).then((result) => {
										if(that.logging){that.log(JSON.stringify(result))};
										pm25 = result.aqi;
										if(that.logging){that.log("pm25: " + pm25)};
									}).catch(err => {
										if(that.logging){that.log("pm25: " + err)};
									})
									break;
								case "pm10":
									// PM10 (ug/m^3)
									var pm10y = parseFloat(aqsensors[aqsensor]);
									aqibot.AQICalculator.getAQIResult("PM10", pm10y).then((result) => {
										if(that.logging){that.log(JSON.stringify(result))};
										pm10 = result.aqi;
										if(that.logging){that.log("pm10: " + pm10)};
									}).catch(err => {
										if(that.logging){that.log("pm10: " + err)};
									})
									break;
								default:
									if(that.logging){that.log("[" + that.serial + "] ignoring " + JSON.stringify(aqsensor) + " for AQI: " + parseFloat(aqsensors[aqsensor]))};
									break;
							}
						}
						
						if(that.logging){that.log("pm25: " + pm25 + " pm10: " + pm10 + " voc: " + voc)};
						
						if (pm25 >= 0) {
							aqi = pm25;
						} else if (pm10 >= 0) {
							aqi = pm10;
						} else if (voc >= 0) {
							aqi = voc;
						} else {
							aqi = -1;
						}
						
						if(that.logging){that.log("AQI: " + aqi)};
						
						if (aqi >= 0 && aqi <= 50) {
							return 1; // EXCELLENT
						} else if (aqi > 50 && aqi <= 100) {
							return 2; // GOOD
						} else if (aqi > 100 && aqi <= 150) {
							return 3; // FAIR
						} else if (aqi > 150 && aqi <= 200) {
							return 4; // INFERIOR
						} else if (aqi > 200) {
							return 5; // POOR
						} else {
							return 0; // Error
						}
					})
					.catch(function(err) {
						if(that.logging){that.log("Error retrieving air quality data: " + err)};
					});
				break;
			case "nowcast-aqi":
				var date = new Date();
				date.setHours(date.getHours() - 12);
				var from = date.toISOString();
				
				var hash = Object.create(null),
					grouped = [],
					hours = [],
					vocs = [],
					pm25s = [],
					pm10s = [];
				
				var aqtemp;
				var aqatmos = 1;
				
				var pm25a = -1;
				var pm10a = -1;
				var voca = -1;
				
				var aqurl = "https://developer-apis.awair.is/v1/" + that.userType + "/devices/" + that.devType + "/" + that.devId + "/air-data/15-min-avg?from=" + from;
				if(that.logging){that.log(aqurl)};
				
				var aqoptions = {
					method: "GET",
					uri: aqurl,
					json: true,
					headers: {
						Authorization: "Bearer " + that.token
					}
				};
				
				return request(aqoptions)
					.then(function(response) {
						var aqdata = response.data;
						if(that.logging){that.log(JSON.stringify(aqdata))};
						
						var aqdatas = aqdata[0];
						var aqdatasx = [];
						aqdatasx.push(aqdatas)
						var aqsensors = aqdatasx
							.map(aqsensor => aqsensor.sensors)
							.reduce((a, b) => a.concat(b))
							.reduce((a, b) => {a[b.comp] = a[b.comp] ? 0.5*(a[b.comp] + b.value) : b.value; return a}, {});
						
						aqtemp = parseFloat(aqsensors.temp);
						
						aqdata.forEach(function (a) {
							var key = a.timestamp.slice(11, 13);
							if (!hash[key]) {
								hash[key] = { hour: key + ':00', sensors: [] };
								grouped.push(hash[key]);
							}
							hash[key].sensors.push(a.sensors);
						});
						
						grouped.sort(function (a, b) {
							return b.hour.localeCompare(a.hour);
						});
						
						if(that.logging){that.log(JSON.stringify(grouped))};
						
						grouped.forEach(function (x) {
							var hour = x.hour;
							var aqsensors = x.sensors
								.reduce((a, b) => a.concat(b))
								.reduce((a, b) => {a[b.comp] = a[b.comp] ? 0.5*(a[b.comp] + b.value) : b.value; return a}, {});
							
							if(that.logging){that.log(JSON.stringify(aqsensors))};
							
							for (var aqsensor in aqsensors) {
								switch (aqsensor) {
									case "voc":
										vocs.push(parseFloat(aqsensors[aqsensor].toFixed(1)));
										break;
									case "dust":
										pm10s.push(parseFloat(aqsensors[aqsensor].toFixed()));
										break;
									case "pm25":
										pm25s.push(parseFloat(aqsensors[aqsensor].toFixed(1)));
										break;
									case "pm10":
										pm10s.push(parseFloat(aqsensors[aqsensor].toFixed()));
										break;
									default:
										if(that.logging){that.log("No relevant sensors found.")};
										break;
								}
							}
						});
					})
					.catch(function(err) {
						if(that.logging){that.log("Error retrieving air quality data: " + err)};
					});
				
				if (pm25s.length > 0) {
					// PM2.5 (ug/m^3)
					aqibot.AQICalculator.getNowcastAQIResult(PollutantType.PM25, pm25s).then((result)=>{
						if(that.logging){that.log(JSON.stringify(result))};
						pm25a = result.aqi;
					}).catch(err =>{
						if(that.logging){that.log(err)};
						pm25a = -1;
					})
					aqi = pm25a;
				} else if (pm10s.length > 0) {
					// PM10 (ug/m^3)
					aqibot.AQICalculator.getNowcastAQIResult(PollutantType.PM10, pm10s).then((result) => {
						if(that.logging){that.log(JSON.stringify(result))};
						pm10a = result.aqi;
					}).catch(err => {
						if(that.logging){that.log(err)};
						pm10a = -1;
					})
					aqi = pm10a;
				} else if (vocs.length > 0) {
					// Chemicals (ug/m^3)
					var aqvoc = parseFloat(voca[0]);
					var aqtvoc = that.convertChemicals(aqvoc, aqatmos, aqtemp);
					aqtvoc = parseFloat(aqtvoc.toFixed());
					aqibot.AQICalculator.getAQIResult("CO", aqtvoc).then((result) => {
						if(that.logging){that.log(JSON.stringify(result))};
						voca = result.aqi;
					}).catch(err => {
						if(that.logging){that.log(err)};
						voca = -1;
					})
					aqi = voca;
				} else {
					aqi = -1;
				}
				
				if(that.logging){that.log("AQI: " + aqi)};
				
				if (aqi >= 0 && aqi <= 50) {
					return 1; // EXCELLENT
				} else if (aqi > 50 && aqi <= 100) {
					return 2; // GOOD
				} else if (aqi > 100 && aqi <= 150) {
					return 3; // FAIR
				} else if (aqi > 150 && aqi <= 200) {
					return 4; // INFERIOR
				} else if (aqi > 200) {
					return 5; // POOR
				} else {
					return 0; // Error
				}
				break;
			default:
				if(that.logging){that.log("No air quality method specified. Defaulting to awair-score method.")};
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
				break;
		}
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
		airQualityService
			.setCharacteristic(Characteristic.AirQuality, "--")
			.setCharacteristic(Characteristic.VOCDensity, "--")
			.setCharacteristic(Characteristic.PM10Density, "--")
			.setCharacteristic(Characteristic.PM2_5Density, "--");
		airQualityService
			.addCharacteristic(Characteristic.StatusFault);
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
			.addCharacteristic(Characteristic.StatusFault);
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
		humidityService
			.addCharacteristic(Characteristic.StatusFault);
		this.humidityService = humidityService;
		services.push(humidityService);
		
		if (this.devType != "awair-mint" && this.devType != "awair-glow-c") {
			var carbonDioxideService = new Service.CarbonDioxideSensor();
			carbonDioxideService
				.setCharacteristic(Characteristic.CarbonDioxideLevel, "--");
			carbonDioxideService
				.addCharacteristic(Characteristic.StatusFault);
			this.carbonDioxideService = carbonDioxideService;
			services.push(carbonDioxideService);
		}
		
		if (this.devType == "awair-omni" || this.devType == "awair-mint") {
			var lightLevelService = new Service.LightSensor();
			lightLevelService
				.setCharacteristic(Characteristic.CurrentAmbientLightLevel, "--");
			lightLevelService
				.addCharacteristic(Characteristic.StatusFault);
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