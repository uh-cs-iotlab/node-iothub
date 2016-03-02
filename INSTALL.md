# Install

## Requirements

* node >= 4.1

## Install node dependencies

`npm install`

## Run the IoT Hub

- Create a file for the admin credentials
```javascript
{
  "username": "ADMIN_USERNAME", //optional
  "email": "ADMIN_EMAIL",
  "password": "ADMIN_PASSWORD"
}
```
- Change the `adminCredentials` property in `server/config.json` with the path to the admin credentials fils. This can be either absolute or relative path from repository root

  `vim server/config.json`

- Start the server

  - `node .` in development environment
  - `NODE_ENV=production node .` in production environment

### Notes about NODE_ENV

`NODE_ENV` variable is a standard in nodejs/express development. Its set by default to development mode.
In development environment, the [API explorer](https://docs.strongloop.com/display/public/LB/Use+API+Explorer) is available. Default mount path is `/explorer` and it can be customized in `server/component-config.development.json`. The datasource used is memory so nothing is persisted across multiple starts of the server.
In production environment, the default datasource is MongoDB. Datasources can be configured in `server/datasources.json` and `server/datasources.production.json`.
