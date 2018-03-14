"use strict";
var Awair = require('awairnode');
var inherits = require('util').inherits;
var Service, Characteristic;

var awairService;

var CarbonDioxide;
var VOC;
var Dust;

var CustomUUID = {
	CarbonDioxide: '10c88f40-7ec4-478c-8d5a-bd0c3cce14b7',
	VOC: 'ccc04890-565b-4376-b39a-3113341d9e0f',
	Dust: '46f1284c-1912-421b-82f5-eb75008b167e'
};

var CustomCharacteristic = {};

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-awair", "Awair", AwairAccessory);
  
	CustomCharacteristic.CarbonDioxide = function() {
		Characteristic.call(this, 'Carbon Dioxide', CustomUUID.CarbonDioxide);
		this.setProps({
			format: Characteristic.Formats.UINT16,
			unit: "ppm",
			maxValue: 5000,
			minValue: 0,
			minStep: 1,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	inherits(CustomerCharacteristic.CarbonDioxide, Characteristic);
	
	CustomCharacteristic.VOC = function() {
		Characteristic.call(this, 'VOC', CustomUUID.VOC);
			this.setProps({
				format: Characteristic.Formats.UINT16,
				unit: "ppb",
				maxValue: 10000,
				minValue: 1,
				minStep: 1,
				perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
			});
			this.value = this.getDefaultValue();
	};
	inherits(CustomerCharacteristic.VOC, Characteristic);
	
	CustomCharacteristic.Dust = function() {
		Characteristic.call(this, 'Dust', CustomUUID.Dust);
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: "ug/m3",
			maxValue: 500,
			minValue: 0,
			minStep: 0.1,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	inherits(CustomerCharacteristic.Dust, Characteristic);
	
}

function AwairAccessory(log, config) {
	this.log = log;
	this.awair = new Awair(config['orgToken']);
	this.devId = config['devId'];
	this.devType = config['devType'];
	this.name = config['name'];
	this.serial = config['serial'];
	if (isNaN(this.serial))
		this.serial = devType + "-" + devId;
	this.model = config['model'];
	if (isNaN(this.model))
		this.model = this.devType;
	this.fetch = config['fetch'];
	if (isNaN(this.fetch))
		this.fetch = 5;
	this.timestampOfLastUpdate = 0;
  
	this.informationService = new Service.AccessoryInformation();
	this.informationService
	.setCharacteristic(Characteristic.Manufacturer, "Awair")
	.setCharacteristic(Characteristic.Model, this.model)
	.setCharacteristic(Characteristic.SerialNumber, this.serial);
	
	this.awairStatsService = new Service.TemperatureSensor(this.name);
	this.awairStatsService.addCharacteristic(Characteristic.CurrentRelativeHumidity);
	this.awairStatsService.addCharacteristic(CustomCharacteristic.CarbonDioxide);
	this.awairStatsService.addCharacteristic(CustomCharacteristic.VOC);
	this.awairStatsService.addCharacteristic(CustomCharacteristic.Dust);
	
	this.updateAwairStats();
}

AwairAccessory.prototype = {
	
	identify: function (callback) {
		this.log("Identify requested!");
		callback(); // success
	},
	
	getServices: function () {
		return [this.informationService, this.awairService];
	},
	
	updateAwairStats: function () {
		var that = this
		
		that.awair.scoreLatest().request(that.devId, that.devType, function(err, response){
			if (!err && response['sensor'] && response['sensor']['temp']) {
				that.timestampOfLastUpdate = Date.now() / 1000 | 0;
				
				that.temperature = response['sensor']['temp'];
				if (isNaN(that.temperature))
					that.temperature = 0;
				that.humidity = response['sensor']['humid'];
				if (isNaN(that.humidity))
					that.humidity = 0;
				that.carbonDioxide = response['sensor']['co2'];
				if (isNaN(that.carbonDioxide))
					that.carbonDioxide = 0;
				that.voc = response['sensor']['voc'];
				if (isNaN(that.voc))
					that.voc = 0;
				if (response['sensor']['dust'] != null) {
					that.dust = response['sensor']['dust'];
					if (isNaN(that.dust))
						that.dust = 0;
				} else {
					that.dust = response['sensor']['pm25'];
					if (isNaN(that.dust))
						that.dust = 0;
				}
				
				that.log("Current Awair stats [Device ID: " + devId + "] Temperature: " + that.temperature + ", Humidity: " + that.humidity + ", Carbon Dioxide: " + that.carbonDioxide + ", VOCs: " + that.voc + ", Dust: " + that.dust);
				
				that.awairService.setCharacteristic(Characteristic.CurrentTemperature, that.temperature);
				that.awairService.setCharacteristic(Characteristic.CurrentRelativeHumidity, that.humidity);
				that.awairService.setCharacteristic(CustomCharacteristic.CarbonDioxide, that.carbonDioxide);
				that.awairService.setCharacteristic(CustomCharacteristic.VOC, that.voc);
				that.awairService.setCharacteristic(CustomCharacteristic.Dust, that.dust);
			} else {
				that.log("Error retrieving the Awair stats")
			}
		});
		
		setTimeout(this.updateAwairStats.bind(this), this.fetch * 60 * 1000);
	}
	
}
