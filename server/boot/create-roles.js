module.exports = function(app) {

    var Role = app.models.Role;

    Role.create(
        { name: 'admin'},
        function(err, role) {
            if(err) return console.error(err);
            console.log('Role created: ', role.name);
        }
    );
};
