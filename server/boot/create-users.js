'use strict';

var fs = require('fs');
var path = require('path');
var inquirer = require('inquirer');

module.exports = function (app) {

    let Role = app.models.HubRole;
    let User = app.models.HubUser;
    let RoleMapping = app.models.RoleMapping;

    let getAdmins = () => {
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

    let isAdminCredentialsValid = (creds) => {
        let keys = Object.keys(creds);
        return keys.length >= 2 && keys.length <= 3;
    };

    getAdmins()
    .then((adminInfos) => {
        let credsPromise = Promise.resolve(null);
        let adminCreds;
        // We check if the credentials are given as parameters (e.g. in tests)
        if (adminCreds = app.get('adminCredentialsObject')) {
            credsPromise = Promise.resolve(adminCreds);
        } else {
            // If not, we look for a credentials file
            let adminCredsConfFile = app.get('adminCredentials') || 'admin-creds.json';
            if (!path.isAbsolute(adminCredsConfFile)) {
                adminCredsConfFile = path.join(__dirname, '..', '..', adminCredsConfFile);
            }
            credsPromise = new Promise((resolve, reject) => {
                fs.access(adminCredsConfFile, fs.R_OK, (err) => {
                    if (err) reject(err);
                    resolve();
                });
            })
            .then(() => fs.readFileSync(adminCredsConfFile, 'utf8'), () => {
                // If file not found and if no admin already exists, create one
                if (adminInfos.principals.length === 0) {
                    console.info('\nCredentials file not found, this assistant will help you to create a new administrator:');
                    return new Promise((resolve) => {
                        inquirer.prompt([
                            {
                                type: 'input',
                                name: 'email',
                                message: 'Enter email address',
                                validate: (input) => {
                                    let re = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
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
            });
        }
        return credsPromise.then(creds => ({creds, infos: adminInfos}));
    })
    .then((adminObj) => {
        let adminCreds = adminObj.creds;
        let adminInfos = adminObj.infos;
        if (adminCreds === null) {
            return Promise.resolve(null);
        } else if (typeof adminCreds === 'string') {
            adminCreds = JSON.parse(adminCreds);
        }
        if (!isAdminCredentialsValid(adminCreds)) {
            return Promise.reject(new Error(`The provided admin credentials are invalid.`));
        } else {
            let where = {};
            if (adminCreds.username) where.username = adminCreds.username;
            if (adminCreds.email) where.email = adminCreds.email;
            return User.findOrCreate(where, adminCreds)
            .then((user) => {
                let adminRoleMapping = {
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
    })
    .then((user) => {
        if (user !== null && app.get('env') === 'development') {
            let username = user.username || user.email;
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
