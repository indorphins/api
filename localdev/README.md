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