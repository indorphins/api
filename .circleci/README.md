# CICD

There is a simple but complete CICD process setup based on the `master`, and `develop` branches. Ideally this would work against a paid version of Github teams where branch protection can be setup.

Commits to the develop branch will automatically generate a new docker image with a tagged version based on the latest git tag, so PRs to the develop branch should first be tagged with a valid version change before merging, and then the newely minted image will be automatically published to ECR, and then released to the development environment.

Once the development release candidate has been fully tested and needs to be promoted to production, send a PR from the develop branch to master, and the merge will trigger a production release of the same image in development.

In addition to the release candidate branches, feature branches can be created that will be automatically built by circleci if the branch name starts with "feat-". Any commit on a branch following that naming pattern will result in a docker image tagged with the same name.

## Circleci Setup

This only needs to be done once after changing the primary repo location.

1. Login to Circleci with your Github account and give access to your repositories, circleci will pickup the .circleci/config.yml file automatically.

2. Add the required AWS credentials to the project

    - Create an IAM access key for the indorphins-cicd user *(AWS access key and secret key)*

    - Go to the indorphins-be project in circleci

    - Go to project settings

    - Go to Environment Variables

    - Add AWS_ACCESS with the access key value

    - Add AWS_SECRET with the secret access key value