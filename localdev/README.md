# localdev

The helper script `start.sh` will start [ngrok](https://ngrok.com/) on your local machine, and update the proxy deployment. Essential for testing third-party authorization flows like Github.

## Setup

Install Ngrok
```shell
brew cask install ngrok
```

## Run

Start ngrok and update the proxy deployment with the new ngrok url
```
./start.sh
```
## Kill Ngrok

Since Ngrok is started in the background there is a helper script to kill the process once you are done.
```
./killNgrok.sh
```

## Docker

The docker image shows the very basic nginx setup required to accomplish this. All nginx does is fetch the ngrok url from the environment using lua and forwards any requests to that url.

Install and setup the Google Cloud CLI
```
brew cask install google-cloud-sdk
```

Build the docker image.
```
docker build -t proxy .
```

Read the google cloud docs on how to deploy the proxy image to [container registry](https://cloud.google.com/container-registry/docs/pushing-and-pulling). Once the image is deployed update the deploy.sh file with the correct image uri.

Run the `env.dev` script in the parent folder to setup all env vars, start ngrok, and deploy a new google cloud proxy.
```
source env.dev
```
