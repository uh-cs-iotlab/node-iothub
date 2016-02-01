module.exports = function(ComposedFeed) {

    ComposedFeed.on('dataSourceAttached', function () {
        if (typeof ComposedFeed.dataSourceAttachedHandler === 'function') {
            ComposedFeed.dataSourceAttachedHandler();
        }
    });

};
