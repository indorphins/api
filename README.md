# Indorphins Backend

[![Indorphins](https://circleci.com/gh/indorphins/api.svg?style=shield&circle-token=107c0259b4f7d65c68880940ac834a16d50da2ed)](https://app.circleci.com/pipelines/github/indorphins/api)

Node.js based express service for the Indorphins video chat application. Currently tested against node version 14.1.

- [Indorphins Backend](#indorphins-backend)
  - [Getting Started](#getting-started)
    - [Install Node](#install-node)
    - [Install Docker](#install-docker)
    - [Run the App](#run-the-app)
  - [Docker](#docker)
    - [Build](#build)
    - [Run](#run)

## Getting Started

### Install Node

Install Node version manager.

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
```

Install node version 14.1 and set as the current node version.

```
nvm install v14.1
nvm use v14.1
```

### Install Docker

[Download docker desktop for Mac here](https://hub.docker.com/editions/community/docker-ce-desktop-mac/) and install.

### Run the App

Install the project dependencies.

```
npm i
```

Start Mongo using the docker-compose file, and give it a few seconds to setup the replica set. This will also start a Mongo database browser on [http://localhost:8080/](http://localhost:8080/).

```
docker-compose up -d
```

Setup the environment vars.

```
export APP_ENV=env/local
```

Start the application.

```
npm start
```

Or, pass the env in at runtime and start it.

```
APP_ENV=env/local npm start
```

Test that you can curl it successfully.

```
curl -i http://localhost:3001/healthy
```

## Docker

A private docker image repository is deployed on AWS ECR [here](https://console.aws.amazon.com/ecr/repositories/indorphins/?region=us-east-1). The builds for this repo are generated through CircleCI on a branch basis. Develop and master branches are reserved for release candidates and the production deployment, while feature branches can also be automatically built using a branch name starting with "feat-". All other branches will be ignored by CICD rules.

### Build

Build a local image of indorphins backend.

```
docker build -t indorphins .
```

### Run

Start Mongo.

```
docker-compose up -d
```

Start the app container.

```
docker run --rm --env-file env/docker.env -p 3001:3001 --network indorphins-be_default indorphins
```

## Docker Compose

Start Mongo and Mongo Express in the background.

```
docker-compose up -d
```

Stop Mongo and Mongo Express.

```
docker-compose kill
```

Remove the stopped containers.

```
docker-compose rm
```

List the docker volumes on your machine, one of which will have the saved mongo database data.

```
docker volume list
```

Delete the mongo database volume.

```
docker volume rm indorphins-be_mongodb_master_data
```

Delete all docker volumes from the system

```
docker volume prune
```

## Local Development Proxy

When supporting third-party callback flows, webhooks, etc., it's important to be able to route the traffic for the third-party servers to your local machine. To accomplish this in a painless way we use a combination of ngrok and nginx to proxy the traffic to a local development server.

Install ngrok

```
brew cask install ngrok
```

Ngrok is a cool little free utility that starts a service on your local machine and an endpoint on their service which will route traffic down to the local service, and then forward it on to whatever local port you specify. For example, this command would create an external enxpoint that proxies the traffic to port 3001 on our local machine:

```
ngrok http 3001
```

The output will print out the public facing URLs you can call. The only downside is that this URL changes with each new ngrok session, and an ngrok session is only good for 24 hours, so you would need to update the whitelisted domains with third-party service providers every time a new ngrok session is started. Far from ideal. To fix this we have deployed a simple nginx service on our kubernetes cluster that will proxy any calls it receives to the public ngrok endpoint. Use the helper script to start it.

```
./localdev/start.sh
```

This will update the nginx deployment with the new ngrok url. Now you can simply run this script every time you want to start a new ngrok session and update the nginx proxy to route traffic to you.

Now start the service and curl it with your new public endpoint.

```
npm start
curl -i http://aadeb486ae1ac42b3a7763e674e8df91-780442730.us-east-1.elb.amazonaws.com/healthy
```

If you need to retrieve the proxy service url use kubectl.

```
kubectl get services -n test
```
