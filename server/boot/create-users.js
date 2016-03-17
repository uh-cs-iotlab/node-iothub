'use strict';

var fs = require('fs');
var path = require('path');
var inquirer = require('inquirer');

module.exports = function (app) {

    var Role = app.models.HubRole;
    var User = app.models.HubUser;
    var RoleMapping = app.models.RoleMapping;

    var getAdmins = () => {
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

    var isAdminCredentialsValid = (creds) => {
        var keys = Object.keys(creds);
        return keys.length >= 2 && keys.length <= 3;
    };

    getAdmins()
    .then((adminInfos) => {
        var adminCredsConfFile = app.get('adminCredentials') || 'admin-creds.json';
        if (!path.isAbsolute(adminCredsConfFile)) {
            adminCredsConfFile = path.join(__dirname, '..', '..', adminCredsConfFile);
        }
        return new Promise((resolve, reject) => {
            fs.access(adminCredsConfFile, fs.R_OK, (err) => {
                if (err) reject(err);
                resolve();
            });
        })
        .then(() => fs.readFileSync(adminCredsConfFile, 'utf8'), () => {
            // If file not found, try to find it as a parameter
            var adminCreds;
            if (adminCreds = app.get('adminCredentialsObject')) {
                return Promise.resolve(adminCreds);
            } else if (adminInfos.principals.length === 0) {
                // If no paramater given and if no admin already exists, create one.
                console.info('\nCredentials file not found, this assistant will help you to create a new administrator:');
                return new Promise((resolve) => {
                    inquirer.prompt([
                        {
                            type: 'input',
                            name: 'email',
                            message: 'Enter email address',
                            validate: (input) => {
                                var re = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
                                return re.test(input) ? true : 'Wrong format for email address';
                            }
                        },
                        {
                            type: 'input',
                            name: 'username',
                            message: 'Enter username',
                            default: '',
                            filter: input => (input === '' ? null : input)
                        },
                        {
                            type: 'password',
                            name: 'password',
                            message: 'Enter password'
                        }
                    ], answers => resolve(answers));
                })
                .then((answers) => {
                    if (answers.username === null) delete answers.username;
                    return answers;
                });
            }
            return Promise.resolve(null);
        })
        .then((adminCreds) => {
            if (adminCreds === null) {
                return Promise.resolve(null);
            } else if (typeof adminCreds === 'string') {
                adminCreds = JSON.parse(adminCreds);
            }
            if (!isAdminCredentialsValid(adminCreds)) {
                return Promise.reject(new Error(`The provided admin credentials are invalid.`));
            } else {
                var where = {};
                if (adminCreds.username) where.username = adminCreds.username;
                if (adminCreds.email) where.email = adminCreds.email;
                return User.findOrCreate(where, adminCreds)
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
                        // if user is not yet an admin, we assign him admin role
                        if (adminPrincipals.length === 0) {
                            return new Promise((resolve, reject) => {
                                adminInfos.role.principals.create(adminRoleMapping, (err) => {
                                    if (err) reject(err);
                                    resolve();
                                });
                            });
                        }
                    })
                    .then(() => user[0]);
                });
            }
        });
    })
    .then((user) => {
        if (user !== null && app.get('env') === 'development') {
            var username = user.username || user.email;
            // Auto-login admin
            user.createAccessToken(0)
            .then((token) => {
                console.log(`Admin "${username}" logged in with token "${token.id}".`);
            }, (err) => {
                console.error(`[ERROR] Couldn't log in user "${username}": ${err.message}`);
            });
        }
        app.emit('adminCreated');
    }, (err) => {
        console.error('[ERROR] During admin authentication:');
        console.error(err.message);
        process.exit(1);
    });
};
