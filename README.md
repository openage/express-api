# Open Age Service

## Overview
It is the framework component for openage services. It implements some of the boilerplate code like
1. User Authentication
2. Endpoint Authorization
3. Repsonse Standardization
4. Response Caching
5. Response Remapping
6. Bulk Request

It also builds the context and adds following mechanisms to it:
1. Caching
2. Configuration
3. Logging
4. Rules Evaluation


## Release Notes
### Version 2.7.9

#### Enhanced security: 
- Implemented session validation with the authentication provider for a more robust authentication mechanism.
- Improved exception handling by hiding server errors and sending the one in `api.errors` section.
#### Refactorings
- Separated all the errors into it own [error file](/helpers/errors.js)

### Version 2.6.0
- Implemented caching of the response.


## Usage

### Getting hierarchical configuration from the context

**TODO:**
- [ ] Complete documentation

### Getting and Setting the Cache

**TODO:**
- [ ] Complete documentation

## Setup

### Installation

1. Add the package
```sh
npm install @open-age/express-api --save
```
2. Add dependencies

**TODO:**
- [ ] Complete documentation

## Configuration

This component uses [config](https://www.npmjs.com/package/config) package. The configuration can be defined at multiple levels.
1. Code Level
2. Installation Level
3. Organization Level
4. Tenant Level

### Caching the response

#### Step 1: Configure cache server
You need to configure the application to use the cache configuration. Here is an example:

```JSON
{
    "cacheServer": {
        "type":"redis",
        "config": {
            "host": "${env:cacheServer.host}",
            "port": "${env:cacheServer.port}",
            "options": {
                "password": "${env:cacheServer.password}",
                "maxmemory": "1gb",
                "maxmemoryPolicy": "allkeys-lru"
            }
        }
    }
}
```

Following cache servers are supported
- [redis](https://github.com/redis/node-redis/tree/master),


This would also be used to [cache the authentication](#caching-the-session) data

#### Step 2: Configure the endpoint

You need to set the endpoint to cache the response. It can be defined at one of the following places (in the order of decreasing preference):
1. In the **tenant** configuration 
```JSON
{
    "config": {
        "api": {
            "resource-get-by-id": {
                "cache": {
                }
            }
        }
    }
}
```
2. At **service** level 
```JSON
{

    "api": {
        "resource-get-by-id": {
            "cache": {
            }
        }
    }
}
```
3. In the **spec path** file `specs/paths/:resource.js`. 
```JSON
{
    "url": "/",
    "get": {
        "id": "resource-get-by-id",
        "cache":{
        }
    }
}
```

The endpoint id, `resource-get-by-id` is defined in `spec/paths/resource.js` file. Even if the id the not defined it will be automatically created according to convention.

The cache section above would take following configuration
```JSON
{
    // unique id with which value will be saved
    "key": "resource_${query}", 
    // seconds after which key and it's value will get deleted
    "ttl": 2000, 
    // action to perfom when the endpoint is hit (defaults to add)
    "action": "add",
    // the condition(optional) that needs to be met 
    // for the response to be cache response
    "condition": {
        "operator": "AND",
        "value": [{ "key": "query.field","operator": "==", "value": "value" }]
    }  
}
```

**TODO:**
- [ ] Add examples with more conditions

### Securing an endpoint
Just like cache you need to [configure](#step-2-configure-the-endpoint) the endpoint by adding `permissions` to it

**TODO:**
- [ ] Complete documentation

### Modifying a response
**TODO:**
- [ ] Complete documentation

### Authentication
#### Validating the claims

##### Requesting ip with that of the token
```JSON
{
    "auth": {
        "validate": {
            "ip": true,
        }
    }
}
```
**TODO:**
- [ ] support for region in the ip like `in-*` 

##### Expiry of the token
1. Following setting will check the expiry of the token against the current time
```JSON
{
    "auth": {
        "validate": {
            "expiry": true,
        }
    }
}
```
2. Following setting will check the status of the session. It should not be `inactive` or `expired` 
```JSON
{
    "auth": {
        "validate": {
            "session": true,
        }
    }
}
```

#### Configuring how the service would authenticate the token

##### Using directory as auth provider

1. Set the `auth.provider` as `directory`
```JSON
{
    "auth": {
        "provider": "directory"
    }
}
```
2. Configure `providers.directory`. Note the system would fetch the session (from id) of the user under the credentials of `providers.directory.role.key`
```JSON
{
    "providers": {
        "directory": {
            "url": "http://api.openage.in/directory/v1/api", // prod url
            "role": {
                "key": "<role key of the tenant owner>"
            }
        }
    }
}

```
##### Caching the session

Add sessions endpoints to the directory provider, and add the cache setting to it. You need to also add [cacheServer](#step-1-configure-cache-server) setting

```JSON
{
    "providers": {
        "directory": {
            "endpoints": {
                "sessions": {
                    "get": {
                        "cache": {
                            "ttl": 60000 // 60 seconds
                        }
                    }
                }
            }
        }
    }
}
```

If the cache is not defined, then the session won't be cahced

##### Using directory as auth provider

### Sending out custom errors `api.errors`
```JSON
{
    "api": {
        "errors": {
            "UNKNOWN": {
                "code": "UNKNOWN",
                "message": "Internal Server Error"
            },
            "ACCESS_DENIED": {
                "code": "ACCESS_DENIED",
                "message": "Insufficient Permission"
            }
        }
    }
}
```
