var request = require('request');
var moment  = require('moment');
/**
 * Leaving in for future development: timeframe queries
 *
 * var _ = require('underscore');
 */

var Awair = function(orgToken, devId) {
    "use strict";

    var that = this;

    that.chainedRequests = [];
    var format = ".json";

    that.scoreLatest = function() {
        this.chainedRequests.push("events/score/latest");
        return this;
    };

    that.fiveMinAvg = function() {
        this.chainedRequests.push("events/5min-avg?limit=1");
        return this;
    };

    that.fifteenMinAvg = function() {
        this.chainedRequests.push("events/15min-avg?limit=1");
        return this;
    };

    /**
     * Performs the actual request
     *
     * @param devId			device ID
	 * @param devType		device type (awair / awair-glow)
     * @param callback		function
     */
    that.request = function(devId, devType, callback){
        // A little pre-query validation
        if (!devId){
            callback(true, "You must supply a devId");
            return;
        }else if (!devType){
			callback(true, "You must supply a devType");
			return;
		}else if (!that.chainedRequests.length){
            callback(true,  "You must specify a resource to request first (e.g. awair.latestScore().request...)");
            return;
        }else if (!_.isFunction(callback)){
            throw "The second argument must be a function";
        }

        // Construct the url
        var options = {
			url: 'https://enterprise.awair.is/v1/orgs/self/devices/' + devType + '/' + devId + '/' + that.chainedRequests.join('');
			headers: {
				'Authorization': 'Bearer ' + orgToken
			}
        that.chainedRequests = [];

        // Request the url
        request(options, function (error, response, body) {
            var json = false;
            if (!error && response.statusCode === 200) {
                error = false;
                try {
                    json = JSON.parse(body);
                } catch (err) {
                    console.error('Exception caught in JSON.parse', body);
                    error = err;
                }
            }
            callback.call(that, error, json);
            return;
        });
    };
};

module.exports = Awair;