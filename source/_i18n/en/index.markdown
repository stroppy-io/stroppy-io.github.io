Stroppy is a framework for testing various types of databases. It allows you to deploy a cluster in the cloud, run load tests and simulate different failures, such as network unavailability of one of the nodes in the cluster.

To complicate the task for the DBMS, Stroppy may try to deliberately break the DB cluster, because in the real world failures happen much more often than we want. And for horizontally scalable databases this happens even more often, since a larger number of physical nodes gives more points of failure.

At the moment, we have implemented support for FoundationDB, MongoDB, CockroachDB and PostgreSQL (which we use a system-wide measure to compare everything else with). In addition, Stroppy makes it easier to analyze test results since it is integrated with Grafana. After each run it automatically collects an archive with the database metrics, which are scaled by the time of running. Also, you can collect even more statistics with the desired frequency. In particular, Stroppy collects the following data for FoundationDB and MongoDB: for FoundationDB it is the ‘status json’ console command output, and for MongoDB it is the ‘db.serverStatus()’ command output.

## Main features

- Deployment of a cluster of virtual machines in the selected cloud via Terraform. Supported options are Yandex.Cloud and Oracle.Cloud.
- Deployment of a Kubernetes cluster inside a running cluster of virtual machines.
- Deployment of the selected DBMS in a running cluster.
- Collecting statistics from Grafana k8s cluster metrics and system metrics of virtual machines (CPU, RAM, storage, etc.).
- Managing test parameters and the deployment in general - from the number of VMs to the supplied load and managed problems.
- Running tests on demand from CLI.
- Logging of the test progress - current and final latency, and RPS.
- Deleting a cluster of virtual machines.
- Deployment of multiple clusters from a single local machine with isolated. monitoring and a startup console.

[Stroppy GitHub](https://github.com/picodata/stroppy)
