module.exports = function(app) {

    var User        = app.models.User,
	    Role        = app.models.Role,
        RoleMapping = app.models.RoleMapping;

    User.create(
        {username: 'username', email: 'username@hub.fi', password: 'password' },
        function(err, user) {
            if(err) return console.error(err);
            console.log('User created: ', user.username);
            //I need to get the admin role
            Role.findOne(
                {where: {name: 'admin'}},
                function(err, role) {
                    if(err) return console.error(err);
                    //Assign our user to the role
                    role.principals.create(
                        {
                            principalType: RoleMapping.USER,
                            principalId: user.id
                        },
                        function(err, principal) {
                            if(err) return console.error(err);
                            console.log('User %s granted as admin', user.username);
                            user.createAccessToken(0, function(err, accessToken) {
                                console.log('The access token for %s is %s', user.username, accessToken.id);
                            });
                        }
                    );
                }
            );
        }
    );

};
