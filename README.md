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

uses `config` package

### Caching the repsponse

```JSON
{

    "api": {
        "<endpoint-code>": {
            "cache": {
                "keys": [],
                "condition": "=",
                "action": "set"
            }
        }
    }
}
```

**TODO:**
- [ ] Add examples

### Securing an endpoint
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
