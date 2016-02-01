module.exports = function(AtomicFeed) {

    AtomicFeed.on('dataSourceAttached', function () {
        if (typeof AtomicFeed.dataSourceAttachedHandler === 'function') {
            AtomicFeed.dataSourceAttachedHandler();
        }
    });

};
