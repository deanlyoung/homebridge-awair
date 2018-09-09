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
	this.token = config["token"];
	this.manufacturer = config["manufacturer"] || "Awair";
	this.devType = config["devType"];
	this.devId = config["devId"];
	this.serial = config["serial"] || this.devType + "-" + this.devId;
	this.carbonDioxideThreshold = config["carbonDioxideThreshold"] || 0; // ppm, 0 = OFF
	this.polling_interval = Number(config["polling_interval"] || 900); // seconds (15 mins)
	this.endpoint = config["endpoint"] || "15-min-avg"; // 15-min-avg, 5-min-avg, raw, latest
	this.url = config["url"] || "http://developer-apis.awair.is/v1/users/self/devices/" + this.devType + "/" + this.devId + "/air-data/" + this.endpoint + "?limit=1&desc=true";
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
		
		this.log("[" + this.serial + "] url: " + this.url);
		
		var that = this;
		
		return request(options)
			.then(function(response) {
				var data = response.data[0];
				
				that.airQualityService
					.setCharacteristic(Characteristic.AirQuality, that.convertScore(data.score));
				that.airQualityService.isPrimaryService = true;
				if (that.devType != "awair-mint") {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService, that.carbonDioxideService];
				} else if (that.devType == "awair-mint") {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService];
				}
				
				var sensors = data.sensors;
				
				var sense = sensors.reduce( (compSensors, sensor) => {
					var comp = sensor.comp;
					var val = sensor.value;
					compSensors[comp] = val;
					return compSensors;
				}, {});
				
				that.log("[" + that.serial + "] " + that.endpoint + ": " + JSON.stringify(sense));
				
				var temp = sense.temp;
				var atmos = 1;
				
				for (sensor in sensors) {
					switch (sensors[sensor].comp) {
						case "temp":
							// Temperature (C)
							that.temperatureService
								.setCharacteristic(Characteristic.CurrentTemperature, sensors[sensor].value)
								.setCharacteristic(Characteristic.StatusFault, 0);
							break;
						case "humid":
							// Humidity (%)
							that.humidityService
								.setCharacteristic(Characteristic.CurrentRelativeHumidity, sensors[sensor].value)
								.setCharacteristic(Characteristic.StatusFault, 0);
							break;
						case "co2":
							// Carbon Dioxide (ppm)
							var co2 = sensors[sensor].value;
							var co2Detected;
							that.carbonDioxideService
								.setCharacteristic(Characteristic.CarbonDioxideLevel, sensors[sensor].value)
								.setCharacteristic(Characteristic.StatusFault, 0);
							if ((that.carbonDioxideThreshold > 0) && (co2 >= that.carbonDioxideThreshold)) {
								co2Detected = 1;
								that.log("[" + that.serial + "] CO2 HIGH: " + co2 + " > " + that.carbonDioxideThreshold);
							} else {
								co2Detected = 0;
								that.log("[" + that.serial + "] CO2 NORMAL: " + co2 + " < " + that.carbonDioxideThreshold);
							}
							that.carbonDioxideService.setCharacteristic(Characteristic.CarbonDioxideDetected, co2Detected);
							break;
						case "voc":
							var voc = sensors[sensor].value;
							tvoc = that.convertChemicals(voc, atmos, temp);
							that.log("[" + that.serial + "]: voc (" + voc + " ppb) => tvoc (" + tvoc + " ug/m^3)");
							// Chemicals (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.VOCDensity, tvoc)
								.setCharacteristic(Characteristic.StatusFault, 0);
							break;
						case "dust":
							// Dust (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM10Density, sensors[sensor].value);
							break;
						case "pm25":
							// PM2.5 (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM2_5Density, sensors[sensor].value);
							break;
						case "pm10":
							// PM10 (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM10Density, sensors[sensor].value);
							break;
						default:
							that.log("[" + that.serial + "] ignoring " + sensors[sensor].comp);
							break;
					}
				}
			})
			.catch(function(err) {
				that.log("[" + that.serial + "] " + err);
				that.temperatureService
					.setCharacteristic(Characteristic.CurrentTemperature, "--")
					.setCharacteristic(Characteristic.StatusFault, 1);
				that.humidityService
					.setCharacteristic(Characteristic.CurrentRelativeHumidity, "--")
					.setCharacteristic(Characteristic.StatusFault, 1);
				if (that.devType != "awair-mint") {
					that.carbonDioxideService
						.setCharacteristic(Characteristic.CarbonDioxideLevel, "--")
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
		var voc = parseFloat(voc);
		var atmos = parseFloat(atmos);
		var temp = parseFloat(temp);
		var vocString = "(" + voc + " * 72.66578273019740 * " + atmos + " * 101.32) / ((273.15 + " + temp + ") * 8.3144)";
		var tvoc = (voc * 72.66578273019740 * atmos * 101.32) / ((273.15 + temp) * 8.3144);
		this.log("[" + this.serial + "] ppb => ug/m^3 equation: " + vocString);
		return tvoc;
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
		this.airQualityService = airQualityService;
		services.push(airQualityService);
		
		var temperatureService = new Service.TemperatureSensor();
		temperatureService
			.setCharacteristic(Characteristic.CurrentTemperature, "--");
		temperatureService
			.addCharacteristic(Characteristic.StatusFault);
		this.temperatureService = temperatureService;
		services.push(temperatureService);
		
		var humidityService = new Service.HumiditySensor();
		humidityService
			.setCharacteristic(Characteristic.CurrentRelativeHumidity, "--");
		humidityService
			.addCharacteristic(Characteristic.StatusFault);
		this.humidityService = humidityService;
		services.push(humidityService);
		
		if (this.devType != "awair-mint") {
			var carbonDioxideService = new Service.CarbonDioxideSensor();
			carbonDioxideService
				.setCharacteristic(Characteristic.CarbonDioxideLevel, "--");
			carbonDioxideService
				.setCharacteristic(Characteristic.StatusFault);
			this.carbonDioxideService = carbonDioxideService;
			services.push(carbonDioxideService);
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
