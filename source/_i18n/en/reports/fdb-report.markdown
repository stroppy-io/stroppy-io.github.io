- [The Problem](#the-problem)  
- [Test](#the-test)  
- [The Subject and the Environment](#the-subject-and-the-environment)  
- [Results](#results)  
- [Conclusions and future work](#conclusions-and-future-work)  

## The Problem

Unlike most of the system software, the database market is as vibrant today as it was ten or twenty years ago. The hardware revolution, switching the industry from rotating to solid state drives, and then from solid state to NVM, all in the course of a single decade, advance of hyper-converged architecture and multi-cloud
create a brave new world for the database vendors and consumers.  
  
Parallel to changes in the hardware world, an open source software revolution presents users with [hundreds of new, free database offerings](https://dbdb.io/) and highlights a multifold growth of the on-premise database market. If that wasn't enough, a massive shift towards polyglot persistence, cloud and multi-cloud databases demonstrates an even bigger growth both in the amount of data and variety of data processing needs.  
  
Financial institutions have long been pioneer adopters of database software, yet surprising laggards when it comes to using NoSQL and the cloud. The concerns of security, manageability and reliability kept the banks at bay \-- conservative, yet disgruntled loyalists of one well known vertically scaled enterprise database.  
  
Indeed, modern NoSQL software was firstly concerned with scalability, simple handling huge amounts of data; then new, developer friendly data models; then the cloud. The needs of banking, such as ACID transactions, data constraints, precision arithmetics were of little or no priority.  
  
After a decade of booming growth, NoSQL database market has begun to mature. MongoDB, the pioneer NoSQL vendor founded in 2007, added transaction support in 2020. CockcroachDB, a PostgreSQL compatible horizontally scalable database, was first released in 2017 and is rapidly gaining traction. FoundationDB, a horizontally scalable transactional database founded in 2013, was quickly acquired by Apple and only recently (2018) released back to the open source community.

In 2021, with more than one free, horizontally scalable, transactional NoSQL database the market seems to be unable to appreciate the tectonic shift: NoSQL no longer means no transactions, and it's possible to get both a durable, ACID compliant and horizontally scalable database in a single product.

Adoption of any significant advance in technology by a wide market is impossible without an industry accepted benchmarks or standards. SQL has had such a benchmark, architected and maintained by the The [Transaction Performance Council](http://tpc.org/), NoSQL movement, while less organized, provided tools for measuring both performance ([YCSB](https://github.com/brianfrankcooper/YCSB/wiki), [LinkBench](https://github.com/facebookarchive/linkbench), [sysbench](https://github.com/akopytov/sysbench)) and consistency ([Jepsen](https://jepsen.io/analyses)). No widely adopted instrument, however, exists to test how well NoSQL databases fare in historically SQL domain: processing financial transactions, or simply put, managing money.

## Test

A credible test has to be capable of proving that the ACID properties are preserved in a distributed NoSQL environment, specifically in presence of node and network failures; applications can scale along with the size of the cluster; the overall performance is better or similar to one of a vertically scaled DBMS running on a similar hardware. The test should be able to stress different cluster topologies, clouds, and products. Since each NoSQL vendor has its own API and language for
standard operations, the application logic executed by the test should be re-implemented for each vendor.

Enter [stroppy](http://github.com/picodata/stroppy), a test for performance and correctness of transactional NoSQL databases. The test runs a typical financial application, performing a series of bank money transfers between user accounts. The key idea that makes it useful for verifying the integrity of data without resorting to an oracle (apart from an intentional pun, an oracle in correctness testing is a service which provides canonical results) is that no amount of
money transfers, hardware, configuration or network events can change the total balance of all accounts. Thus, the test consists of three main steps:

1. Data generation. Bank accounts are loaded in batches of initial balances. A personal account differs from a corporate one only by a smaller initial balance. A sum of all balances is calculated an stored separately as the canonical / expected result.

2. A series of money transfers is carried out between accounts. The
transfers could represent an end-of-month payroll for a corporateaccount or peer-to-peer transfers between personal accounts. The transfers run in parallel and can use the same source or target account. Naturally, in a clustered database accounts reside on different cluster nodes.

3. The end balances are downloaded and accumulated in a register. The overall balance should not change.

Step 2 is paralleled with a pre-scripted nemesis: scenarios of network partitions, hardware failures and cluster topology changes.

## The Subject and the Environment

[FoundationDB](https://www.foundationdb.org/) is a transactional NoSQL database maintained by Apple and available to a broad community under the terms of [Apache 2.0 license](https://github.com/apple/foundationdb/blob/master/LICENSE). A key design property of FoundationDB is [service-based, non-homogenous architecture](https://apple.github.io/foundationdb/kv-architecture.html). A few key application roles, such as storage, transaction log, proxy and coordinator, can be placed at different nodes of the cluster. This gives DBAs the flexibility to trade between read and write throughput, as well as achieve high availability even in tiny clusters. FoundationDB, however, lacks most features except [basic ones](https://apple.github.io/foundationdb/data-modeling.html):
all data is stored in a one global namespace, secondary keys or a query language is missing. For Stroppy this is an acceptable design constraint, since it implements an own vendor specific application layer, capable of working over only a small set of core database features. Indeed, this is what makes Stroppy vendor-agnostic.

The testing journey with FoundationDB had three key goals:

- see if FoundationDB provides ACID properties (or not)

- see if it is not a hardware hog, and performs at least as well as a vertical vendor such as PostgreSQL on a similar hardware

- see if it scales, so e.g. by doubling or quadrupling the amount of cores or cluster nodes we could at least double the throughput ofthe application.

PostgreSQL was chosen as a measuring stick: it\'s a [widely adopted SQL database](https://db-engines.com/en/system/PostgreSQL) that is known to handle financial workloads fairly well. The two initial clusters for FoundationDB had only 3 and 5 single-core nodes, and PostgreSQL is known to scale well up to 20 or 30 cores, so the performance numbers were expected to be not too far apart. The third test was running FoundationDB on 20 nodes, and was intended to show how well it scales.

A few cluster topologies were checked to see if scalability depends on the size of the cluster, workload, or FoundationDB configuration. And of course, the nemesis actions were run in parallel to the workload to verify if the cluster sustains failures and runs well in a degraded state. Oracle Cloud Infrastructure (OCI) was chosen as the testing cloud. To simplify deployment and be able to standardize execution of adverse actions all vendors were managed using a stock kubernetes operator.

Network bandwidth in all of the tests was set to 1 Gb/s; disk bandwidth was limited to 1Gb/s for single-core instances, and proportionally larger for multi-core (1Gb/s per core). Oracle cloud instance type was E3.Flex.

Finally, [Chaos-mesh](https://chaos-mesh.org/) was adopted as a widely known failure injection tool for kubernetes.

## Results

Benchmark results lacking in explanation are equally lacking in credibility. In total over a hundred of tests were performed, tweaking configurations of database, cluster, and client, and a few most descriptive results selected. Due tuning of both vendors was done, both by means of using the official Kubernetes operator and based on the expertise available to the benchmarking team.\ For PostgreSQL the tuning started with using pg\_bouncer, tweaking configuration parameters such as shared\_buffers and max\_connections and ended with application tuning, e.g. finding the optimal structure of database schema, transaction serialization level and the payment transaction body.  
  
For FoundationDB, the Kubernetes operator automatically sets up \[fdbserver\] configuration, so the team played with the number of cores per instance, number of pods, and cloud parameters, such as ensuring cloud drives have enough IOPS to sustain the load put by the benchmarks.  
  
Despite our fair effort in tuning the database, it must be disclaimed that the testing team is by no means a tuning expert in FoundationDB or PostgreSQL, and the purpose of the test was not to find each database's sweet spot. Our goals were to verify correctness and see if the vendors can scale, and for these a fair amount of tuning is only a means to avoid the common configuration pitfalls.  
  
In our runs, PostgreSQL performance was IO bound, partly due to the fact that it was running in a replicated configuration. PostgreSQL test runs using a large number of concurrent clients were mostly bottlenecked inside the PostgreSQL transaction subsystem, for these runs I/O and CPU played a smaller role.  
  
FoundationDB performance was mostly limited by the amount of CPU available to key roles, such as the transaction log and the coordinator. CPU utilization ranged from 50% to 80+% at most loaded instances. Finding an optimal cloud and database configuration for each product is a separate search vector. We attribute fairly low performance numbers of FoundationDB with non-memory resident data set to an increase in disk read I/O, eventually hitting the default Oracle Cloud container IOPS
limits. It's not impossible that tweaking FoundationDB configuration and placement of Kubernetes pods could yield better performance numbers.  
  
Both vendors sustained prolonged tests well, running dozens of hours, and provided stable performance, regardless of whether the data set is memory-resident or is bigger than RAM.  

Table 1: A consolidated result of key test runs: FoundationDB, PostgreSQL (\*)  

<table>
<thead>
<tr class="header">
<th>№№</th>
<th>vendor</th>
<th>Number of nodes</th>
<th><p>VCPU/</p>
<p>Node</p></th>
<th><p>RAM/</p>
<p>Node,GB</p></th>
<th>HDD/Node, GB</th>
<th>Clients</th>
<th>Accounts, Millions</th>
<th>Transfers, millions</th>
<th>TPS</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><a  id="first_test_fdb_rps" href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#first_test_fdb_rps">1</a></td>
<td>FDB</td>
<td>3</td>
<td>1</td>
<td>8</td>
<td>100</td>
<td>16</td>
<td>10</td>
<td>100</td>
<td><strong>2263</strong></td>
</tr>
<tr class="even">
<td>2</td>
<td>FDB+chaos</td>
<td>3</td>
<td>2</td>
<td>8</td>
<td>100</td>
<td>16</td>
<td>10</td>
<td>100</td>
<td><strong>2189</strong></td>
</tr>
<tr class="odd">
<td>3</td>
<td>FDB</td>
<td>5</td>
<td>1</td>
<td>8</td>
<td>100</td>
<td>512</td>
<td>10</td>
<td>100</td>
<td><strong>7631</strong></td>
</tr>
<tr class="even">
<td>4</td>
<td>FDB+chaos</td>
<td>5</td>
<td>1</td>
<td>8</td>
<td>100</td>
<td>512</td>
<td>10</td>
<td>100</td>
<td><strong>7528</strong></td>
</tr>
<tr class="odd">
<td>5</td>
<td>FDB</td>
<td>5</td>
<td>1</td>
<td>16</td>
<td>100</td>
<td>512</td>
<td>100</td>
<td>100</td>
<td><strong>5782</strong></td>
</tr>
<tr class="even">
<td>6</td>
<td>FDB</td>
<td>20</td>
<td>1</td>
<td>16</td>
<td>100</td>
<td>512</td>
<td>100</td>
<td>100</td>
<td><strong>10854</strong></td>
</tr>
<tr class="odd">
<td>7</td>
<td>FDB</td>
<td>5</td>
<td>1</td>
<td>16</td>
<td>100</td>
<td>512</td>
<td>1000</td>
<td>10</td>
<td><strong>3369</strong></td>
</tr>
<tr class="even">
<td>8</td>
<td>PG</td>
<td>2</td>
<td>3</td>
<td>30</td>
<td>100</td>
<td>128</td>
<td>10</td>
<td>100</td>
<td><strong>2059</strong></td>
</tr>
<tr class="odd">
<td>9</td>
<td>PG</td>
<td>2</td>
<td>10</td>
<td>160</td>
<td>100</td>
<td>256</td>
<td>100</td>
<td>100</td>
<td><strong>5915</strong></td>
</tr>
</tbody>
</table>
  
(\*) The key difference between runs, as reflected on the left, is cluster topologies. FoundationDB uses async I/O and runs many actors in a single thread, thus a single process is typically satisfied with a single VCPU. Run №2 highlights that additional VCPU does not lead to increased throughput.  
  
Concurrency played another important role in reaching the maximum throughput: for FoundationDB, the optimal throughput was reached with 512 clients, whereas for PostgreSQL increasing the number of clients actually degraded performance and led to increased latency, despite our use of pg\_bouncer.  
  
Run №5 compared with Run №4 highlights the workload is not memory bound - with the doubling of RAM per instance and a tenfold increase in the size of the data set, throughput decreased by \~ 30% due to a larger distribution of data, and, accordingly, an increase in the time for searching and updating records. At the same time, judging by the monitoring data of these and subsequent runs, an increase in memory of more than 8 GB per node does not have a significant impact on
performance.\ The largest increase is given by scaling the cluster by the number of nodes/CPU.  
  
For larger data sets, however, we were able to observe a markedly lower performance, which we currently attribute by the 1Gb/s combined IO and network bandwidth limit of a single FoundationDB instance in Oracle cloud (see test \#7 and \#5 for comparison).
  
Runs №2 and №4 include nemesis, and also showcase lack of accumulated performance degradation - the overall performance stays on the same level despite continuous removal of the nodes and network partitions for a short time.  

Overall the performance of two databases falls in the same ballpark.  

Table 2: Latency (\*)  

<table class="latency">
<thead>
<tr class="header">
<th>№№</th>
<th>Vendor</th>
<th colspan="2">Payment test</th>
</tr>
<tr class="header">
<th></th>
<th></th>
<th><p>latency, ms</p>
<p>(average)</p></th>
<th><p>latency, ms</p>
<p>(max)</p></th>
<th><p>latency, ms</p>
<p>99% percentile</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><a id="first_test_fdb_lat" href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#first_test_fdb_lat">1</a></td>
<td>FDB</td>
<td>7</td>
<td>241</td>
<td>45</td>
</tr>
<tr class="even">
<td>2</td>
<td>FDB+chaos</td>
<td>8</td>
<td>380</td>
<td>52</td>
</tr>
<tr class="odd">
<td><a id="third_test_fdb_lat" href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#third_test_fdb_lat">3</a></td>
<td>FDB</td>
<td>67</td>
<td>856</td>
<td>201</td>
</tr>
<tr class="even">
<td>4</td>
<td>FDB+chaos</td>
<td>71</td>
<td>889</td>
<td>227</td>
</tr>
<tr class="odd">
<td><a id="5_test_fdb_lat" href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#5_test_fdb_lat">5</a></td>
<td>FDB</td>
<td>88</td>
<td>934</td>
<td>271</td>
</tr>
<tr class="even">
<td>6</td>
<td>FDB</td>
<td>47</td>
<td>565</td>
<td>82</td>
</tr>
<tr class="odd">
<td>7</td>
<td>FDB</td>
<td>151</td>
<td>1267</td>
<td>588</td>
</tr>
<tr class="even">
<td>8</td>
<td>FDB</td>
<td>62</td>
<td>4511</td>
<td>203</td>
</tr>
<tr class="odd">
<td>9</td>
<td>FDB</td>
<td>43</td>
<td>3568</td>
<td>133</td>
</tr>
</tbody>
</table>

(\*) The latency chart demonstrates saturation points in run №5 (FDB) and run №8 (PostgreSQL)  
  
<table class="size">
<thead>
<tr class="header">
<td>Vendor</td>
<td>accounts, millions</td>
<td>tranfers, millions</td>
<td>Disk footprint at test end, GB</td>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>FDB</td>
<td>10</td>
<td>100</td>
<td>18 Gb</td>
</tr>
<tr class="even">
<td>FDB</td>
<td>100</td>
<td>100</td>
<td>32 Gb</td>
</tr>
<tr class="odd">
<td>FDB</td>
<td>100</td>
<td>400</td>
<td>88 Gb</td>
</tr>
<tr class="even">
<td>FDB</td>
<td>1000</td>
<td>10</td>
<td>127 Gb</td>
</tr>
<tr class="odd">
<td>FDB</td>
<td>100</td>
<td>1000</td>
<td>225 Gb</td>
</tr>
<tr class="even">
<td>PG</td>
<td>10</td>
<td>100</td>
<td>71 Gb</td>
</tr>
</tbody>
</table>

The size of the data set (data footprint) provides a good insight into the cause of lower or higher performance of the database - the bigger is the raw amount of data it has to manage on disk, the lower are the numbers.

The nemesis tests were run on a cluster with three and five nodes and simulated network partitions and hardware failures. For example, the test could kill one node out of a three or a five node cluster every two minutes (the killed node was immediately replaced with an empty one by the kubernetes operator). The choice of the node was fixed for a 3-node cluster or random for a five-node one. Apart from a \~5 second availability pause following a pod failure tests passed with comparable
performance and correct resulting balance. During the pause FoundationDB was moving the coordinator role to a live node.

## Conclusions and future work

Behind the brevity of this report are hundreds of hours of testing using different clouds, cluster and client topologies, types of adverse actions. Our key finding is the lack of one that could discredit FoundationDB as a product: we were unable to make FoundationDB lose transactions, degrade the cluster with individual node failures or network partitions, and observed that the database continues to work normally after restoring from a degraded state or hours of workloads. Performance of a small cluster is comparable to one of 3-core replicated PostgreSQL, and a 4 times bigger cluster doubles the performance of the original topology.  
  
While the cluster evidently doesn't scale linearly, the result is considered to be a good one for the fairly correlated workload of money transfers. A number of configurations are outside of the scope of the tests: larger clusters, e.g. with hundreds or thousands of cores, larger data sets, different workload types, different types of background activity, such as growing the cluster, backup and restore.  

This study was not concerned with side by side comparison database features, community size, licensing or vendor support, all playing key roles when selecting a database platform. It seems the future for these is pre-defined: as the market for transactional NoSQL matures, more vendors are destined to try to attry customers in the fintech industry, and pressure from competitors will push the leaders farther ahead, to the benefit of the consumer.  
  
Our nearest plans, however, include adding more vendors to the comparison. Any horizontally scalable database with transaction support is of interest to us, while MongoDB and CockroachDB seem to be the most obvious candidates.  
  