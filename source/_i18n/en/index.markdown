Stroppy is a framework for testing various databases. It allows you to deploy a cluster in the cloud, run load tests and simulate, for example, network unavailability of one of the nodes in the cluster.

To complicate the task for the DBMS, Stroppy may try to break the DB cluster, because in the real world failures happen much more often than we want. And for horizontally scalable databases, this happens even more often, since a larger number of physical nodes gives more points of failure.

At the moment, we have implemented support for FoundationDB, MongoDB, CockroachDB and PostgreSQL (you need to compare everything else with something).
In addition, in order to make it easier to analyze test results, stroppy is integrated with Grafana and after each run automatically collects an archive with monitoring schedules scaled by run time. Also, for FoundationDB and MongoDB, internal statistics are collected with a specified frequency - for FoundationDB, data from the status json console command is collected, for MongoDB, data from the db.serverStatus() command is collected.

## Main features

- Deployment of a cluster of virtual machines in the selected cloud via terraform. Yandex.Cloud and Oracle are supported.Cloud
- Deploying kubernetes cluster in a deployed cluster of virtual machines
- Deployment of the selected DBMS in this cluster
- Collecting statistics from Grafana k8s cluster metrics and system metrics of virtual machines (CPU, RAM, storage, etc.)
- Managing the parameters of tests and the deployment itself - from the number of VMs to the load supplied and managed problems
- Running tests on command from the console
- Logging of the test progress - current and final latency and RPS
- Deleting a cluster of virtual machines
- Deployment of multiple clusters from a single local machine with isolated monitoring and a startup console

[Stroppy GitHub](https://github.com/picodata/stroppy)
