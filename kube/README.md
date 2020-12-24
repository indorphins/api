# [Kubernetes](https://kubernetes.io/docs/home/)

- [Kubernetes](#kubernetes)
  * [Setup](#setup)
  * [Get Service Endpoint](#get-service-endpoint)
  * [Deploy Indorphins](#deploy-indorphins)
  * [Update Indorphins](#update-indorphins)
  * [AWS EKS Creation](#aws-eks-creation)
    + [Monitoring](#monitoring)
      - [Kubernetes Dashboard](#kubernetes-dashboard)
      - [Prometheus](#prometheus)
      - [Grafana](#grafana)

Kubernetes abstracts away provisioning of cloud virtualized resources and deployment of services. It is a fairly complex application built to orchestrate Docker containers and with a lot of new concepts you need to wrap your head around to ultimately get proficient, but this basic guide should be enough to get any developer going quickly. 

## Setup

Get the latest version of `awscli` or install it.

```
pip install awscli
```

Install `minikube`, which has a number of essential utilities for working with Kubernetes.

```
brew install minikube
```

Make sure `kubectl` is available.

```
kubectl version
```

Install aws `eksctl` for some helpful AWS EKS utilities.

```
brew install eksctl
```

Get the kube config of the existing cluster.

```
eksctl utils write-kubeconfig --cluster indorphins --region us-east-1
```

Verify you can connect to the cluster and view the running applications.

```
kubectl get pods
```

Should output something like

```
No resources found in default namespace.
```

Or

```
NAME                             READY   STATUS    RESTARTS   AGE
indorphins-be-6f494bbb55-9l9xs   1/1     Running   0          4m27s
indorphins-be-6f494bbb55-cmk9v   1/1     Running   0          4m27s
```

## Get Service Endpoint

```
kubectl get services
```

Outputs:

```
NAME            TYPE           CLUSTER-IP       EXTERNAL-IP                                                              PORT(S)        AGE
indorphins-be   LoadBalancer   10.100.204.233   a20e416b41a4b43cb9ef548a1797870e-478635041.us-east-1.elb.amazonaws.com   80:32374/TCP   7m23s
```

The External-IP can be used to contact the service. For more detailed service info:

```
kubectl get service indorphins-be -o yaml
```

## Deploy Indorphins



Deploying the application with `kubectl` is simple. There are two environments defined `dev.yml` and `prod.yml`. Pass in the filename for the environment to deploy.

```
kubectl apply -f ./prod.yml
kubectl apply -f ./dev.yml
```

> *Note: Indorphins depends on a ConfigMap for the application configuration, which can be deleted and redeployed if values need to be updated. Both dev and prod use the same config currently.*

```
kubectl delete configmap <configmap-name> 

kubectl create configmap indorphins-config --from-env-file=../env/prod.env
kubectl create configmap indorphins-dev-config --from-env-file=../env/dev.env

```


## Update Indorphins

Change VERSION to the docker image tag version to deploy

```
kubectl --record deployment.apps/indorphins-be set image deployment.v1.apps/indorphins-be indorphins-be=586425846122.dkr.ecr.us-east-1.amazonaws.com/indorphins:latest

kubectl --record deployment.apps/indorphins-be-dev set image deployment.v1.apps/indorphins-be-dev indorphins-be-dev=586425846122.dkr.ecr.us-east-1.amazonaws.com/indorphins:latest
```

For the latest version simply use "latest" as the VERSION.

It is also possible to update the `kube/app.yml` file with the new image and simply apply the change. 

To get rollout status:

```
kubectl rollout status deployment.v1.apps/indorphins-be
```

## AWS EKS Creation

Use the `awscli` and their secondary cli tool `eksctl` which takes care of a lot of the AWS plumbing needed to create a managed kubernetes cluster. This will take 15 to 20 minutes.

```
eksctl create cluster --name indorphins --without-nodegroup --region us-east-1 --vpc-cidr 10.10.0.0/16
```

Once the cluster is up test that you can reach it.

```
kubectl get pods --all-namespaces
```

Login to AWS and use the Console to create node groups. There are a number of options to choose from, and security groups and VPCs have to be setup, and the UI makes this simple.

After a node group has been created, deploy the updated ConfigMap for AWS user authentication for cluster administration. This is crafted for indorphins needs.

```
kubectl apply -f ./aws-auth.yml
```

Allow pods to connect to external services.

```
kubectl set env daemonset -n kube-system aws-node AWS_VPC_K8S_CNI_EXTERNALSNAT=true
```

Lastly, [create and deploy the cluster autoscaler](https://docs.aws.amazon.com/eks/latest/userguide/cluster-autoscaler.html).


### Monitoring

#### Kubernetes Dashboard

Follow the AWS guide on how to [install the kubernetes dashboard](https://docs.aws.amazon.com/eks/latest/userguide/dashboard-tutorial.html). A definition for step 3 of that guide has already been created and can be run with the below command.

```
kubectl apply -f ./eks-admin-account.yml
```

Get a static token through the awscli to login to the dashboard.

```
kubectl -n kube-system describe secret $(kubectl -n kube-system get secret | grep eks-admin | awk '{print $1}')
```

This will print out a token that can be copied and used to login. Now start the kubectl proxy.

```
kubectl proxy --port=8001
```

Login to view cluster or application metrics.

[http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/#!/login](http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/#!/login)

#### Prometheus

Prometheus is used to gather metrics from across the cluster, for custom metrics or logs, and for event alerting to various locations.

Install [helm](https://helm.sh/).

```
brew install helm
helm repo add stable https://kubernetes-charts.storage.googleapis.com
helm repo update
```

Add Prometheus cluster monitoring

```
kubectl create namespace prometheus
helm install prometheus stable/prometheus \
  --namespace prometheus \
  --set alertmanager.persistentVolume.storageClass="gp2",server.persistentVolume.storageClass="gp2" \
  -f ./prometheus-config.yml
```

It can take a minute for the service to come up so check the pods status. If there are any issues with the pods coming up you the kubernetes dashboard will provide helpful information

```
kubectl get pods -n prometheus
```

Start the prometheus dashboard proxy and open [http://localhost:9090](http://localhost:9090)

```
kubectl --namespace prometheus port-forward deploy/prometheus-server 9090
```

#### Grafana

Prometheus has some basic dashboarding capabilities, but it is definitely not as feature rich as Grafana for dashboarding. By installing Grafana with a helm chart we will get a public monitoring endpoint with basic account security that privileged users can easily access anywhere.

Install Grafana.

```
helm install grafana stable/grafana \
  --namespace prometheus \
  --set rbac.create=false --set service.type=LoadBalancer \
  --set persistence.enabled=true
```

Follow the instructions in the helm output to get the Grafana admin password, and then use kubectl to get the endpoint URL to login to the Grafana dashboard (*it can take a few minutes for the load balancer DNS name to resolve*):

```
kubectl get services --namespace prometheus grafana
```

Once logged in, add Prometheus as a Grafana data source, and configure it with `http://prometheus-server` as the URL. Lastly, install some of the helpful pre-built Grafana dashboards for Kubernetes that will aggragate the most essential cluster metrics and give some well done dashboards.

## Appendix

### Minikube

Before diving right into all the AWS setup you can try kubernetes really quickly and easily with Minikube, which runs a single node cluster in a VM. All you need to do to start a cluster is:

```
minikube start
```

Once the cluster is up you can test you can test most all of the above on your local machine, like just bring up the service, or try out some helm charts to deploy new services.

To view the kubernetes dashboard.

```
minikube dashboard
```

And to tear-down the cluster when you are done.

```
minikube delete
```