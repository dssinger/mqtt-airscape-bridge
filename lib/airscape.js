const logging = require('homeautomation-js-lib/logging.js')
const _ = require('lodash')
const request = require('request')
const EventEmitter = require('events')
const interval = require('interval-promise')
const xml_parser = require('xml2js')
var current_speed = null

const airscapeIP = process.env.AIRSCAPE_IP

if (_.isNil(airscapeIP)) {
    logging.warn('AIRSCAPE_IP not set, not starting')
    process.abort()
}

module.exports = new EventEmitter()

module.exports.off = function() {
    send_airscape_request(4, null)
}


module.exports.setSpeed = function(target_speed) {
    logging.info('Targeting speed: ' + target_speed)
    if (current_speed == target_speed) {
        logging.info('Same speed, bailing')
        return
    }
    var delta = target_speed - current_speed
    current_speed = target_speed


    if (target_speed == 0) {
	this.off()   
        return
    }

    var dir=1  //  Assume up
    if (delta < 0) {
	dir = 3
    }


    interval(async() => {
        send_airscape_request(dir, null)
    }, 2000, { iterations: Math.abs(delta) })
}

const send_airscape_request = function(command, callback) {
    var airscape_url = 'http://' + airscapeIP + '/fanspd.cgi'
    if (command != null) {
        airscape_url = airscape_url + '?dir=' + command
    }

    logging.info('request url: ' + airscape_url)
    request(airscape_url, function(error, response, body) {
        if ((error !== null && error !== undefined)) {
            logging.error('error:' + error)
            logging.error('response:' + response)
            logging.error('body:' + body)
        }

        if (callback !== null && callback !== undefined) {
            return callback(error, body)
        }
    })
}

const checkFan = function() {
    logging.debug('Checking fan...')

    send_airscape_request(null, function(error, body) {
        if (error !== null && error !== undefined) {
            return
        }
        var body_list = null
        var fixed_lines = null
        var fixed_body = null

        try {
            body_list = body.split('\n')
            fixed_lines = body_list.map(function(line) {
                return line.substr(line.indexOf('<'))
            })
            fixed_body = fixed_lines.join('\n')
            fixed_body = '<?xml version="1.0" encoding="utf-8"?>\n<root>\n' + fixed_body + '</root>'
        } catch (err) {
            logging.error('error: ' + err)
        }

        logging.debug('fixed_body: ' + fixed_body)
        xml_parser.parseString(fixed_body, { trim: true, normalize: true, normalizeTags: true }, function(err, result) {
            try {
                logging.debug('result: ' + Object.keys(result))
                var callback_value = (!_.isNil(result) && !_.isNil(result.root)) ? result.root : null
                if (!_.isNil(callback_value) && !_.isNil(result.root)) {
                    current_speed = result.root.fanspd
                }

                if (!_.isNil(callback_value)) {
                    module.exports.emit('fan-updated', callback_value)
                }

            } catch (err) {
                logging.error('callback error: ' + err)
            }
        })
    })
}

const startMonitoring = function() {
    logging.info('Starting to monitor: ' + airscapeIP)
    interval(async() => {
        checkFan()
    }, 5 * 1000)
}

const speedUp = function() {
    logging.info('... upping speed')
    send_airscape_request(1, null)
}

startMonitoring()
