module.exports = function(ExecutableFeed) {

    ExecutableFeed.on('dataSourceAttached', function () {
        if (typeof ExecutableFeed.dataSourceAttachedHandler === 'function') {
            ExecutableFeed.dataSourceAttachedHandler();
        }
    });

};
