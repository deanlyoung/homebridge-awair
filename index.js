"use strict";
var Awair = require('awairnode');
var lowerCase = require('lower-case');
var Service, Characteristic;

var awairService;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-awair", "Awair", AwairAccessory);
}

function AwairAccessory(log, config) {
	this.log = log;
	this.awair = new Awair(config['token']);
	this.devId = config['devId'];
	this.devType = lowerCase(config['devType']);
	this.name = config['name'];
	this.serial = config['serial'] || devType + "-" + devId;
	this.model = config['model'] || this.devType;
	this.carbonDioxideThreshold = config['carbonDioxideThreshold'] || 1200;
	this.mpolling = config['polling'] || 0;
	this.polling = this.mpolling;
	this.timestampOfLastUpdate = 0;
	
	if (this.polling > 0) {
		var that = this;
		this.polling *= 60000;
		setTimeout(function() {
			that.servicePolling();
		}, this.polling);
	};
	
	
}

AwairAccessory.prototype = {
	
	servicePolling: function(){
		this.log.debug('Awair Polling...');
		this.getAwairData(function(p) {
			var that = this;
			that.airQualityService.setCharacteristic(Characteristic.AirQuality, p);
			that.temperatureService.setCharacteristic(Characteristic.Temperature, p);
			that.humidityService.setCharacteristic(Characteristic.CurrentRelativeHumidity, p);
			that.carbonDioxideService.setCharacteristic(Characteristic.CarbonDioxideLevel, p);
			setTimeout(function() {
				that.servicePolling();
			}, that.polling);
		}.bind(this));
	},
	
	identify: function (callback) {
		this.log("Identify requested!");
		callback(); // success
	},
	
	getServices: function () {
		var services = [],
			informationService = new Service.AccessoryInformation();
		
		informationService
			.setCharacteristic(Characteristic.Manufacturer, "Awair")
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial);
			services.push(informationService);
		
		this.airQualityService = new Service.AirQualitySensor(this.name);
		this.airQualityService
			.getCharacteristic(Characteristic.AirQuality)
			.on('get', this.getAirQuality.bind(this));
			this.airQualityService.addCharacteristic(Characteristic.StatusFault);
			this.airQualityService.addCharacteristic(Characteristic.PM2_5Density);
			this.airQualityService.addCharacteristic(Characteristic.PM10Density);
			this.airQualityService.addCharacteristic(Characteristic.VOCDensity);
			services.push(this.airQualityService);
		
		this.temperatureService = new Service.TemperatureSensor(this.name);
		this.temperatureService
			.getCharacteristic(Characteristic.CurrentTemperature)
			.setProps({ minValue: -273, maxValue: 200 })
			.on('get', this.getAwairData.bind(this));
			this.temperatureService.addCharacteristic(Characteristic.StatusFault);
			services.push(this.temperatureService);
		
		this.humidityService = new Service.HumiditySensor(this.name);
		this.humidityService
			.getCharacteristic(Characteristics.CurrentRelativeHumidity)
			.setProps({ minValue: 0, maxValue: 200 })
			.on("get", this.getAwairData.bind(this));
			this.humidityService.addCharacteristic(Characteristic.StatusFault);
			services.push(this.humidityService);
		
		if () {
			this.carbonDioxideService = new Service.CarbonDioxideSensor(this.name);
			this.carbonDioxideService
				.getCharacteristic(Characteristics.CarbonDioxideLevel)
				.setProps({ minValue: 400, maxValue: 5000 })
				.on("get", this.getAwairData.bind(this));
				this.carbonDioxideService
					.getCharacteristic(Characteristic.CarbonDioxideDetected)
					.setValue( > this.carbonDioxideThreshold ? Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL : Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL)
				services.push(this.carbonDioxideService);
		}
		
		return services;
	},
	
	getAwairData: function () {
		var that = this;
		
		that.awair.scoreLatest().request(that.devId, that.devType, function(err, response){
			if (!err && response['data']) {
				var temp;
				for(var i = 0; i < response['data']['sensors'].length; i++) {
					if(response['data']['sensors'][i]['comp'] == 'temp') {
						temp = parseFloat(response['data']['sensors'][i]['value']);
					}
				}
				
				for (var sensor in response['data']['sensors']) {
					switch (response['data']['sensors'][sensor]['comp']) {
						case 'temp':
							that.temperatureService.setCharacteristic(Characteristic.StatusFault,0);
							that.temperatureService.setCharacteristic(Characteristic.CurrentTemperature,parseFloat(response['data']['sensors'][sensor]['value']));
							break;
						case 'humid':
							that.humidityService.setCharacteristic(Characteristic.StatusFault,0);
							that.humidityService.setCharacteristic(Characteristic.CurrentRelativeHumidity,parseFloat(response['data']['sensors'][sensor]['value']));
							break;
						case 'co2':
							that.carbonDioxideService.setCharacteristic(Characteristic.StatusFault,0);
							that.carbonDioxideService.setCharacteristic(Characteristic.CarbonDioxideLevel,parseFloat(response['data']['sensors'][sensor]['value']));
							break;
						case 'voc':
							that.airQualityService.setCharacteristic(Characteristic.StatusFault,0);
							var voc = parseFloat(response['data']['sensors'][sensor]['value']);
							voc = (voc * 12.187 * 111.86)/(273.15 + temp)
							that.airQualityService.setCharacteristic(Characteristic.VOCDensity,parseFloat(voc));
							break;
						case 'dust':
							that.airQualityService.setCharacteristic(Characteristic.StatusFault,0);
							that.airQualityService.setCharacteristic(Characteristic.PM10Density,parseFloat(response['data']['sensors'][sensor]['value']));
							break;
						case 'pm25':
							that.airQualityService.setCharacteristic(Characteristic.StatusFault,0);
							that.airQualityService.setCharacteristic(Characteristic.PM2_5Density,parseFloat(response['data']['sensors'][sensor]['value']));
							break;
						case 'pm10':
							that.airQualityService.setCharacteristic(Characteristic.StatusFault,0);
							that.airQualityService.setCharacteristic(Characteristic.PM10Density,parseFloat(response['data']['sensors'][sensor]['value']));
							break;
					}
				}
				
				that.log.debug(JSON.stringify(JSON.parse(response),null,2););
			} else {
				that.airQualityService.setCharacteristic(Characteristic.StatusFault,1);
				that.temperatureService.setCharacteristic(Characteristic.StatusFault,1);
				that.humidityService.setCharacteristic(Characteristic.StatusFault,1);
				that.carbonDioxideService.setCharacteristic(Characteristic.StatusFault,1);
				
				that.log.error(JSON.stringify(JSON.parse(err),null,2););
			}
		});
	}
	
}