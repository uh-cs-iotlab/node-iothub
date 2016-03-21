# IoT Hub

## Getting started

Start by cloning the repository and install node dependencies. You may also want to install dev dependencies. To compile client files, run `npm run-script build`. If you are in development environment, the build will not end because it is watching for changes in source files.

Run IoTHub with `node .`. If it is the first time you run the hub, you will be asked to enter admin credentials. A user will be created in database. Remember you can also store credentials inside a JSON file and specify the path to the file in `server/config.json` with the key **adminCredentials**. The format of this file must be this one:

```
{
   "email": YOUREMAIL,
   "username": YOURUSERNAME,
   "password": YOURPASSWORD
}
```
Note that **username** key is optional.

You can now access the documentation of the hub API at `/doc`.

If you run the hub in development environment and if you specified an admin user either with a file or via the assistant, you will be logged in automatically and the access token will be printed in the console. You have to use the access token for authentify yourself for each request. You can use the token either as the "Authorization" HTTP header or as the "access_token" URL parameter.

### Creating a feed

There are three types of feeds: Atomic, Composed or Executable. You can manage them via a REST API. Let's create your first feed, in this case an atomic feed:

```
POST http://localhost:3000/api/feeds/atomic
Body:
{
    "name": "aFeed"
}
```

You can see that we get in response a JSON object with some properties. One of these is the feed's id that we have to use to identify the feed in future requests.

Now let's create a field that we will attach to this feed. An atomic feed can only have one field while a composed feed can handle many. A field must have a type. Let's say we want to store temperature values, so we have to use the type `root/temperature`.

```
POST http://localhost:3000/api/feeds/atomic/[YOUR FEED ID]/field
Body:
{
    "name": "aField",
    "type": "root/temperature"
}
```

Now your atomic feed is created and has a field attached to it, but you still can't send data to it. You must first **validate** it. Validating a feed creates the background data collection that will keep all the data you will send to it. Let's validate our feed.

```
POST http://localhost:3000/api/feeds/atomic/[YOUR FEED ID]/validate
```

Now you can begin to send data to your feed, but you may ask which format you have to use. The field types define data format following the JSON Schema standard. To get the format to use with your feed, just ask it directly:

```
GET http://localhost:3000/api/feeds/atomic/[YOUR FEED ID]/data-format
Response:
{
    "aField": {
        "format": {...},
        "required": false
    }
}
```

As you can see, the format for each field is given in JSON Schema. Now you can send your temperature data to the feed:

```
POST http://localhost:3000/api/feeds/atomic/[YOUR FEED ID]/data
Body:
{
    "aField": {
        "unit": "cel",
        "value": 4.2
    }
}
```