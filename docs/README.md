# Solmuhub

Solmuhub is the Node.js implementation of the IoT Hub. 
It is currently build upon the [loopback](http://loopback.io/), which is a Node.js REST API framework, to generate the the REST API.

IoT Hubs provides fine-grained access control to IoT devices, data and other resources such as IoT Hub containers to enable remote execution of code (e.g., distributed analytics, edge/fog computing, etc.).

Resources are exposed via the REST API of the hub which enables interactions with other hubs.

## Installation

* Via the sources: `git clone https://github.com/uh-cs-iotlab/solmuhub.git`
* Via npm: Not yet published

### Build

1. `npm install` (Install all the dependencies)
2. `npm run-script build` (Compile the client side files with Gulp)
    * Not mandatory, the client side build is called before `npm start`
3. `npm start` to start the hub
    * If it is the first time you run the hub, you will be asked to enter admin credentials. The admin user will be created in database.
    * If you run the hub in development environment and if you specified an admin user either with a file or via the assistant, you will be logged in automatically and the access token will be printed in the console. You have to use the access token for authentify yourself for each request. You can use the token either in the `Authorization` HTTP header or in the `access_token` URL parameter.

### Configuration

As Solmuhub is build upon loopback, the configuration of the Hub follows the same structure as any loopback application. 
The folder `server` contains a number of files that are used to configure
the IoT Hub application:

* `server/config.json`: the most important file for the configuration of the solmuhub. In this file, you can specify the **port**, **host** and the base url for **API** (default is /api). Additionally, an adminCredential file can be specified to automatically generate a user admin when developping the hub (do not use in production)
    - Content of the adminCredential file
    ```json
    {
        "email": YOUREMAIL,
        "username": YOURUSERNAME,
        "password": YOURPASSWORD
    }
    ```
    Note that **username** key is optional.
* `server/datasources.json`: the second most important configuration file. It is used to let solmuhub knows which data sources can be used to store persistant or non-persistant data. Solmuhub uses mainly the memory (development) and the mongodb connectors of loopback, however others are available to depending on your needs <https://docs.strongloop.com/display/public/LB/Database+connectors>
* `server/model-config.json`: the third most important configuration file. It is used to connect data models (which are defined in `common/models`) with data sources defined in the previous configuration file. Additionally, you can specify here what models are available via the REST API. Models are described [here](./models.md). More detailed information about the models in loopback can be found here: <https://docs.strongloop.com/display/public/LB/Customizing+models>
* Other loopback config files (limited use in Solmuhub):
    * `server/middleware.json`: a config file for middleware in loop
    * `server/component-config.json`: a JSON description of the component that can be attached to the hub routers. Detailed information about components can be found here: <https://docs.strongloop.com/display/public/LB/LoopBack+components>
* **Solmuhub-specific** configuration files:
    * `server/feed-types.json`: Not really a configuration files, but it describes the types of feed we have in the IoT Hub ([atomic](./atomicFeed.md), [composed](./composedFeed.md) and [executable](./executableFeed.md)).

## Concept

The IoT Hub includes a few key components that needs to be manipulated to use the hub (models are described in the [model documentation](./models.md)):

* Hub user: Hub users are a key concept of the IoT Hub. One may create as many users that can connect to the platform. The initial user is the admin user (the creator of the IoT Hub) which has access to all request in the API
* Hub role: Roles can be created to refined the access control to certain API URLs. Roles can be assigned to users to allow access to certain URLS. By default, all users but the admin do not have access to any resources in the IoT Hub.
* Feed: The feed concept is the most important for the IoT Hub. It exposes IoT resources to be used via the REST API. By default, resources are unusable before they have been exposed as feeds. Feeds are of three basic kinds:*
    * [Atomic feed](./atomicFeed.md): Atomic feeds are the basic feed type to connect physical and virtual IoT resources to the IoT Hub (e.g., a temperature sensor, a light bulb, etc.). A core attribute of atomic feed is that they only provide a single type of [data](#data).
        - [HubPlugin](./plugin.md): Plugins are IoT Hub script (i.e., javascript) that are running in the IoT Hub container to enable the communication between the Hub and the devices. The Javascript engine is augmented with a number of communication protocols (e.g., HTTP, TCP sockets, Bluetooth low energy, etc.) depending on the plugin needs. The role of the plugin is to provide a generic access (i.e., generic data model) of the resource to the hub. 
        - [HubEnabler](./enabler.md): Enablers are link to instance of plugins but enable specific configuration of the plugin. For instance, one could install one plugin but have multiple instance of this plugin with specific configurations.
    * [Composed feed](./composedFeed.md): Composed feed are the most traditional feed types and the only type of feed which provides data storage. Unlike atomic feeds, composed feeds can combined multiple data types together.
    * [Executable feed](./executableFeed.md): The last type of feed which expose computing resources to users with enough permission to run IoT Hub code (note: unlike the container for plugins, the executable feed only can only perform HTTP calls to the IoT Hub API on top of bare javascript code). These instance have no access to the local file system and cannot communicate with devices directly
* Service (Not yet ported to solmuhub, only available via Kahvihub):
    - [HubPlugin](./plugin.md): Plugins can be also used to create services. Unlike plugins for atomic feeds, communication protocols but HTTP are not made available. However, it is possible to do period calls via `setTimeout` to periodically perform some operation.
    - Hub Service: Pretty similar to enablers, but services expose different resources via the API (To be discussed later (TODO)).

### Client-side documentation

The documentation of the hub API is available on the client side via the URL: `/doc`. The documentation shows all the possible REST URL that are accessible for a hub.

### <a id="data"></a>Data

One of key strength of the IoT Hub is that IoT developers and users only manipulate abstraction of IoT devices and the data that they produce to perform operations.

The built-in data models of the IoT Hub are available in the `server/schemas` folder. They are currently 5 models supported by the IoT Hub natively. But you can also add you own models to expand your IoT Hub implementation. We use [json-schema](http://json-schema.org/) to define our data formats.
1. `string`: Basic string data
2. `number`: Basic number format (equivalent to Javascript number)
3. `boolean`: Basic boolean format
4. `integer`: Basic integer format
5. `temperature`: Temperature data format
    * Temperature data include a field for `value` of type `Number` and a `unit`field of type `String`. Unit must be of know types ("cel", "far", "kel")
    Example of a valid temperature data:
    ```json
    { "value"=40.3, "unit"="cel"}
    ```
    Examples of an invalid temperature data:
    ```json
    { "value"=40.3}
    ```
    ```json
    { "value"=40.3, "unit"="unknown unit"}
    ```

The number of IoT Hub data formats supported natively by Solmuhub will be significantly in the future to cover most usually IoT devices and data types.

### Creating a feed

There are three types of feeds: Atomic, Composed or Executable. You can manage them via a REST API. Let's create your first feed, in this case a composed feed:

```
POST http://localhost:3000/api/feeds/composed
Body:
{
    "name": "aFeed"
}
```

You can see that we get in response a JSON object with some properties. One of these is the feed's id that we have to use to identify the feed in future requests.

Now let's create a field that we will attach to this feed. A field must have a type. Let's say we want to store temperature values, so we have to use the type `root/temperature`.

```
POST http://localhost:3000/api/feeds/composed/[YOUR FEED ID]/fields
Body:
{
    "name": "aField",
    "type": "root/temperature",
    "required": true
}
```

### Sending data to a feed

Now your composed feed is created and has a field attached to it, but you still can't send data to it. You must first **validate** it. Validating a feed creates the background data collection that will keep all the data you will send to it. Let's validate your feed.

```
POST http://localhost:3000/api/feeds/composed/[YOUR FEED ID]/validate
```

Now you can begin to send data to your feed, but you may ask which format you have to use. The field types define data format following the JSON Schema standard. To get the format to use with your feed, just ask it directly:

```
GET http://localhost:3000/api/feeds/composed/[YOUR FEED ID]/data-format
Response:
{
    "aField": {
        "format": {...},
        "required": true
    }
}
```

As you can see, the format for each field is given in JSON Schema. Now you can send your temperature data to the feed:

```
POST http://localhost:3000/api/feeds/composed/[YOUR FEED ID]/data
Body:
{
    "aField": {
        "unit": "cel",
        "value": 4.2
    }
}
```