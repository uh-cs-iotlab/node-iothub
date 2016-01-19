module.exports = function(Model, options) {

    Model.defineProperty('name', {type: 'string', required: true});
    Model.defineProperty('metadata', {type: 'string', default: ''});
    Model.defineProperty('keywords', { type: ['string'], default: [] });

};
