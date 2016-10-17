'use strict'

const winston = require('winston');
const path = require('path');
// winston.emitErrs = true;

let transportsArr, devTransports, zeitTransports;

devTransports = [
    new winston.transports.File({
        level: 'error',
        filename: path.join(__dirname, '../../logs/error', 'error.log'),
        handleExceptions: true,
        json: true,
        maxsize: 5242880, //5MB
        maxFiles: 5,
        colorize: false
    }),
    new winston.transports.Console({
        level: 'info',
        handleExceptions: true,
        json: false,
        colorize: true
    })
]

zeitTransports = [
    new winston.transports.Console({
        level: 'info',
        handleExceptions: true,
        json: false,
        colorize: true
    })
]

transportsArr = process.env.NOW ? zeitTransports : devTransports;

const logger = new winston.Logger({
    transports: transportsArr,
    exitOnError: false
});

module.exports = logger;
module.exports.stream = {
    write: function(message, encoding){
        logger.info(message);
    }
};