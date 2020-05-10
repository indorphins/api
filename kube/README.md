# [Kubernetes](https://kubernetes.io/docs/home/)

Kubernetes is a fairly complex application with a lot of new concepts you need to wrap your head around to ultimately get proficient. This basic guide should be enough to get any developer going quickly.

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

Install aws `eksctl` for some helpful utilities.

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
kubectl get service indorphins-be
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

## Connect to Dashboard

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

## Deploy Indorphins

Deploying the application with `kubectl` is simple.

```
kubectl apply -f ./app.yml
```

## Update Indorphins

Change VERSION to the docker image tag version to deploy

```
kubectl --record deployment.apps/indorphins-be set image deployment.v1.apps/indorphins-be indorphins-be=662730807386.dkr.ecr.us-east-1.amazonaws.com/indorphins:VERSION
```

It is also possible to update the `kube\app.yml` file with the new image and simply apply the change. 

To get rollout status:

```
kubectl rollout status deployment.v1.apps/indorphins-be
```

## AWS EKS Creation

Use the `awscli` and their secondary cli tool `eksctl` which takes care of a lot of the AWS plumbing needed to create a managed kubernetes cluster.

```
eksctl create cluster --name indorphins --without-nodegroup --region us-east-1
```

- Login to AWS and use the Amazon Console to create node groups. There are a number of options to choose from, and security groups and VPCs have to be setup, and the UI makes this simple.


- [Create cluster autoscaler](https://docs.aws.amazon.com/eks/latest/userguide/cluster-autoscaler.html)


- [Install kubernetes dashboard](https://docs.aws.amazon.com/eks/latest/userguide/dashboard-tutorial.html)