module.exports = function(app) {

    var Role        = app.models.HubRole;
    var User        = app.models.HubUser;
    var RoleMapping = app.models.RoleMapping;

    var getAdmins = function () {
        return new Promise((resolve, reject) => {
            Role.findOrCreate({name: 'admin'}, {name: 'admin'}, (err, role) => {
                if (err) reject(err);
                resolve(role);
            });
        })
        .then((role) => {
            return new Promise((resolve, reject) => {
                role.principals((err, principals) => {
                    if (err) reject(err);
                    resolve({role, principals});
                });
            });
        });
    };

    var isAdminCredentialsValid = function (creds) {
        var keys = Object.keys(creds);
        return keys.length >= 2 && keys.length <= 3;
    };

    var adminCredentialsVar = app.get('adminCredentials') || 'ADMINCRED';
    var adminCredentials = process.env[adminCredentialsVar];

    getAdmins()
    .then((adminInfos) => {
        if (!adminCredentials) {
            return Promise.reject(new Error(`No admin credentials found in environment.`));
        } else {
            var adminCredentialsParsed = JSON.parse(adminCredentials);
            if (!isAdminCredentialsValid(adminCredentialsParsed)) {
                return Promise.reject(new Error(`The provided admin credentials are invalid.`));
            } else {
                var where = {};
                if (adminCredentialsParsed.username) where.username = adminCredentialsParsed.username;
                if (adminCredentialsParsed.email) where.email = adminCredentialsParsed.email;
                return User.findOrCreate(where, adminCredentialsParsed)
                .then((user) => {
                    var adminRoleMapping = {
                        principalType: RoleMapping.USER,
                        principalId: user[0].id
                    };
                    return new Promise((resolve, reject) => {
                        adminInfos.role.principals(adminRoleMapping, (err, adminPrincipals) => {
                            if (err) reject(err);
                            resolve(adminPrincipals);
                        });
                    })
                    .then((adminPrincipals) => {
                        if (adminPrincipals.length === 0) {
                            return new Promise((resolve, reject) => {
                                adminInfos.role.principals.create(adminRoleMapping, (err, principal) => {
                                    if (err) reject(err);
                                    resolve();
                                });
                            });
                        } else {
                            resolve();
                        }
                    })
                    .then(() => user[0]);
                });
            }
        }
    })
    .then((user) => {
        var username = user.username || user.email;
        console.log(`User ${username} granted ad admin.`);
        if (process.env.DEV) {
            // Auto-login admin
            user.createAccessToken(0)
            .then((token) => {
                console.log(`User "${username}" logged in with token "${token.id}".`);
            }, (err) => {
                console.error(`[ERROR] Couldn't log in user "${username}": ${err.message}`);
            });
        }
    }, (err) => {
        console.error('[ERROR] During admin authentication:');
        console.error(err.message);
        process.exit(1);
    });

};
