# localdev

The helper script `env.dev` will start [ngrok](https://ngrok.com/) on your local machine, and then update a deployed Google Cloud Run docker container to route all calls from the GCE service to the local ngrok listener, and then finally to your local machine. This way you can setup a GCE Cloud Run service with a domain like `mytest.asy.la`, or use the default google domain, and calls to that service will eventually be routed to your local machine.

Essential for testing third-party authorization flows like Github.

## Setup

Install Ngrok
```shell
brew install ngrok
```

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

## Kill Ngrok

Since Ngrok is started in the background there is a helper script to kill the process once you are done.
```
. localdev/killNgrok.sh
```