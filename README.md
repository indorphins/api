# Indorphins Backend

[![Indorphins](https://circleci.com/gh/afloesch/indorphins-be.svg?style=shield&circle-token=3fc72662729760bb207849bed87c75d4c593848e)](https://app.circleci.com/pipelines/github/afloesch/indorphins-be)

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
