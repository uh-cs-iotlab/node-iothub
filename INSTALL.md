# Installation of the Node.js version of the IoT Hub

## Requirements

* node >= 4.1

## Installation

`npm install`

## Run the IoT Hub

### Create a file for the admin credentials
```json
{
  "username": "ADMIN_USERNAME",
  "email": "ADMIN_EMAIL",
  "password": "ADMIN_PASSWORD"
}
```
### Change the server config file to link to the admin credentials file
`vim server/config.json`

### Start the server
`NODE_ENV=DEV node .`

