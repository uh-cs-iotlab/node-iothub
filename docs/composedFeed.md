# Composed feeds

Composed feed are the most traditional feed types and the only type of feed which provides data storage. Unlike atomic feeds, composed feeds can combined multiple data types together.

For all the example listed below we assume
$BASE_URL: the base url of the IoT Hub
$PORT: the port of the IoT Hub server listens to
$API: the api route defined in `server/config.json`

# Listing composed feeds

The list of composed feeds can be obtained by a single `GET` request to the API via:

**`GET`** *`${BASE_URL}:$PORT/$API/feeds/composed`*
```json
[
    {

    }
]
```

# Creating a new feed

## Manually (currently the only available method)
<table width="100%">
    <tr>
        <td>Request</td>
        <td>**`POST`** *`${BASE_URL}:$PORT/$API/feeds/composed`*</td>
    </tr>
    <tr>
        <td>Data</td>
        <td>
            ```json
            { "Test": 12 }
            ```
        </td>
    </tr>
    <tr>
        <td>Result</td>
        <td>
            ```json
            { "Test": 12 }
            ```
        </td>
    </tr>
</table>