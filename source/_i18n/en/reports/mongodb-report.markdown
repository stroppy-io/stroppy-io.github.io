- [Introduction](#introduction)  
- [General results](#general-results)  
- [Failover tests](#failover-tests)  
- [Final remarks](#final-remarks)  
- [Conclusions](#conclusions)  

## Introduction

MongoDB is a schema-less document-oriented database. A pioneer of the document data model, MongoDB in many ways defined what we understand under “NoSQL” databases today. Starting from version 3.0, it added optional schema validation and enforcement features, bringing itself closer to traditional DBMS.

MongoDB was first to introduce a binary representation for JSON data, Binary JavaScript Object Notation (BSON). Another feature we naturally expect from NoSQL – horizontal scaling – was added to MongoDB relatively late. MongoDB’s building block for horizontal scaling is called a replica set – a set of nodes each having a full copy of the data. One of the replicas in the replica set takes the leading role. When data no longer fits a single replica set, another replica set is added to the cluster and the data is redistributed. This is less flexible compared to, e.g. bucket or token based sharding, when it’s enough to add just one node to a cluster to take off the load from existing members.

In a cluster made of just one replica set the availability can be improved by using an arbiter – a light-weight process that takes part in leader elections but does not store any data.

On the query side, MongoDB supports data aggregation, secondary indexes and range queries. Query routing and execution at data nodes is managed by the load balancer and one or many configuration servers. The latter can form an own replica set solely responsible for storing cluster settings and topology (the mapping of routing keys to network locations of the data). Replicating the configuration server is necessary to provide high availability for the entire cluster. Different roles used by nodes of the cluster make MongoDB cluster configuration a bit trickier than with some other products, where the entire cluster is homogenous, but provide for more flexibility.

During our MongoDB hands-on we had three main goals:

- check if MongoDB transactions are ACID
- check if hardware demands are moderate compared to vertically scaling databases such as PostgreSQL and our first contendant, FoundationDB
- check if we can scale the system up and out, eg. by doubling or quadrupling the number of cores or replicasets (shards).

While testing FoundationDB and PostgreSQL we identified a few common configurations with meaningful performance characteristics. So we started with them first. As you may know from our previous tests, we run 3 workloads – small, medium, and large, and try to accommodate each workload with reasonable hardware. Our first small test was conducted on a 3-node replica set, each node running 1 or 2 virtual cores. Further tests expanded this configuration to evaluate both vertical and horizontal scaling.

In the end, we added more hardware than ever: hoping to close the performance gap we discovered – but to no avail. For example, for the ‘big’ MongoDB test we used a several-fold larger cluster, both in CPU and RAM, than we used for testing FoundationDB. And we tried to distribute these resources both as a single replica set and scaled out to multiple shards.

The table below shows results of the most meaningful tests. Those include tests for fault tolerance and measurements of a sharded cluster performance in presence of network and node failures.


## General results

*Notes*

>1) All tests shown in Table 1 were conducted using the MongoDB defaults.  We made a number of attempts to tune the configuration but it never had a noticeable impact and therefore such test results were omitted.
1) All test results refer to MongoDB 4.4. Replacing version 4.4 with 5.0 produced results within the error margin. We also tried out Percona MongoDB Server image known to provide 100% compatibility with the vanilla MongoDB Community server, but did not notice any significant gains or losses.
1) As of now the official MongoDB Community Operator does not support sharding and limits the deployment options only to one replica set. The Enterprise operator has licensing issues which we, not being experts in intellectual property law, wanted to avoid. Due to these considerations we chose to take the open source Percona operator to the test. It supported all the features we needed.
The first two MongoDB tests did not use sharding and were conducted using the MongoDB Community Operator, the subsequent tests used the Percona operator.
1) Table 1 only includes the successfully completed tests with Nemesis injections; there were unsuccessful attempts as well, and their description follows.
1) We used hash-based, as opposed to range-based sharding. We observed more even data distribution and stable tail latency when using it. Stroppy does not use range queries (if it had then the range-based mapping would have improved results by a large margin).

#### Table 1. Key MongoDB tests results

|Test #|VCPUper node|RAM per node,GB|HDD per node, GB|Shards|Replicas|Clients|Nodes|Counts, mln|Transactions, mln|Transactions per second|
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
|1|1|8|100|1|3|16|3|10|10|**340**|
|2|2|8|100|1|3|16|3|10|10|**720**|
|3|4|8|100|1|3|64|3|10|10|**1843**|
|4|4|8|100|1|3|128|3|10|10|**2661**|
|5|2|8|100|2|3|32|6|10|10|**427**|
|6|6|16|100|1|2+1 arbiter|128|3|100|100|**2725**|
|7|6|16|100|1|3|128|3|100|100|**2761**|
|8|6|12|100|1|2+1 arbiter|128|3|100|100|**2592**|
|9|6|12|100|1|3|128|3|100|100|**2551**|
|10|2|8|100|2|3|128|6|100|100|**575**|
|11|2|8|100|2|3|128|6|100|100|**445**|
|12|4|8|100|8|3|128|12|100|100|**1171**|
|13|8|16|100|2|3|128|6|1000|10|**443**|
|14|8|16|100|4|3|128|12|1000|10|**718**|
|15|8|16|100|4|3|128|12|1000|10|**670**|
|16|4|8|100|8|3|128|12|1000|10|**947**|
|17|12|40|100|1|3|128|3|1000|10|**3272**|
|18|3|8|100|2|3|128|6|10|10|**653**|
|19|3|8|100|2|3|128|6|10|10|**534**|

#### Table 2. Latencies

|Test #|Latency, ms (medium)|Latency, ms (max)|Latency, ms (99 percentile)|
| :- | :-: | :-: | :-: |
|1|22|401|79|
|2|47|793|178|
|3|35|1037|104|
|4|45|1807|172|
|5|75|800|217|
|6|47|2763|173|
|7|46|2424|171|
|8|49|26515|169|
|9|50|2066|221|
|10|222|4052|801|
|11|287|6372|1434|
|12|109|4148|500|
|13|288|7293|1099|
|14|178|4137|867|
|15|190|5917|631|
|16|135|5578|898|
|17|39|1824|111|
|18|195|4990|662|
|19|239|2972|657|

#### Table 3. Data set sizes (\*)

|Counts, mln|Transfers, mln|Data size on disk, GB|Data size on disk, FoundationDB|
| :- | :- | :- | :- |
|10|10|3 GB|3 GB|
|100|100|24 GB|32 GB|
|1000|10|136 GB|127 GB|


>(\*) The table represents the total size of two collections and their indexes retrieved via the administrative panel of MongoDB.

**Regardless of whether you’re familiar with our FoundationDB results, the numbers above speak for themselves: if you want transaction workload to perform well with MongoDB, you’re better off scaling vertically, not horizontally. A stronger statement is that transaction performance in MongoDB is generally bound to the throughput of a single node, and does not improve much by adding replica sets.**

The best performance we were able to get used a configuration with a single 3-node replica set, each node equipped with 12 virtual cores and 40 GB of RAM (see Test #9). The workload was CPU-bound, with master replica CPU usage above 80%. We also observed high (over 85%) disk utilization on all of the replicas, which we explain by the larger-than-RAM data set size (136GB vs 40GB RAM).

For a memory-resident workload, e.g. in test #1 (one replicaset, 1 CPU / 8 GB of RAM per replica) and test #2 (2 CPUs per replica), increasing the number of cores gives a proportional increase in performance. Doubling the number of cores along with increasing the number of workers, as seen in test #3 and #4, ultimately gives an acceleration of 8 times compared to the minimum configuration (see test #1). Splitting the same computing power across several replica sets leads to a lower performance (see test #5).

The “medium” test brings a transition to a “marginal” memory/disk ratio. The data still mostly fits in RAM but not quite, especially if we take secondary keys into consideration. An additional goal of these test series was to check if adding more replicas or an arbiter had any impact on performance.

The performance continued to stay CPU-bound, with disk IO quite intensive nonetheless. The disk work was mostly reads, not writes. Even with doubling the number of cores per replica and the amount of RAM, the performance was still below the best results in the ‘small’, memory-resident test.

Tests #6-#9 demonstrate the impact of introducing an arbiter.  Arbiters are [mongod](https://docs.mongodb.com/manual/reference/program/mongod/#mongodb-binary-bin.mongod) instances that are part of a [replica set](https://docs.mongodb.com/manual/reference/glossary/#std-term-replica-set) but do not hold data (i.e. do not provide data redundancy). The difference of 1-1.5% is within the error margin. To conclude, adding an arbiter does not bear much fruit. At the same time, a replica set with an arbiter cannot be used for subsequent horizontal scaling.

Pairs #6-#8 and #7-#9 represent the performance change when the available RAM is decreased by 25%. Tests #7 and #9 with 3 replicas show a drop of 8.2%. Indeed, even with a 25% decrease in RAM, the hottest data – client accounts – was still memory-resident.

As long as the data set exceeds the amount of RAM, changing the amount of RAM or the number of cores doesn’t make much of a difference. This is shown both in the ‘big’ run #17 and the ‘medium’ run #7 where despite the two-fold increase in the number of cores and more than a threefold increase in RAM per replica, the performance gain is a meager 30%.

Tests #10-#16 are focused on horizontal scaling. Unfortunately, they fail our latency expectations of 100ms per transaction in 99% of cases. Our tests of FoundationDB with  fewer cores show a 3-6 times lower latency and 4-8 higher throughput.

Sharded MongoDB requires a separate balancer replica set (3 replicas, up to 2 CPU per replica) as well as a separate configuration server (1 CPU, 0.5 GB RAM per replica). The costs for these nodes are not included in the summary table, but can have a significant impact on the TCO of a small cluster.

More interesting findings follow. In test #5 we found that one of the leader of the replica set uses up to 100% of the CPU, so we decided to conduct tests #13 and #14 with a 4 times more CPU, 2x increase in RAM, and with a 100x increase in data size (the ‘big’ tests). Adding cores along with moving from two shards to four led to performance gain of only 62%: not what we expected, and definitely worse-than-linear. CPU consumption was approximately ~2.5 cores per replica.

Tests #10 and #15  were run with the XFS file system instead of the default EXT4. To draw comparison, check test #10 and #14 respectively. The results show that XFS was ~22% faster (575 vs 718) in memory-bound workload, but 7% slower for a disk-bound one (670 vs 718). Resource utilization was about the same for both EXT4 and XFS though the IO pattern was different: in both tests XFS is more read than write heavy compared to EXT4.

As we’ve already noted, once the data size stops fitting in RAM, there is a discrete drop in throughput. On the positive side, further degradation is more predictable. Check test #16, where tenfold increase in the data set size compared to test #12 impacts the performance by only 23%.

Our best big test is #17, a single replica set vertically scaled to 12-core nodes with 40GB of RAM. Its results are almost 3 times faster than when distributing the same resources across 8 replicasets (test #12). To put things in perspective, the same TPS can be obtained on a 4-core PostgreSQL or five 2-core FoundationDB nodes. Best numbers were recorded with 128 concurrent clients. This is also significantly lower than PostgreSQL (256 clients), or FoundationDB (512 clients).

### Failover tests

Tests #18 and #19 run with a two-replica-set cluster and were used to check the impact of network interrupts and hardware failures. We tried:

- restarting any running replica on any shard every two minutes. In this mode, we were unable to advance past loading the data. The log was full of *Could not find host matching read preference { mode: "primary" }* and the performance dropped to a halt.
- restarting one of the two **predefined** replicas on one shard every two minutes. Similarly, we failed to get through the load stage.
- disconnecting one of the two predefined replicas on one shard every two minutes accompanied by recurring network errors and leader election errors. We managed to load all the data in this mode, but not complete the  transaction test. The root cause was an error which we didn’t know how to handle on the client side: *TransactionExceededLifetimeLimitSeconds error* (exceeding the default limit of 10 s). Since it was unclear from the documentation whether this is a definite failure or uncertainty, we had to stop each worker which received such an error.
- restarting one of the two predefined replicas on different shards every two minutes. This test did run to an end and you can see its results in row #18
- 100% network degradation between two selected replicas on the same shard every two minutes, also a successful test shown in row #19

>(\*) restarting with chaos-monkey is implemented by stopping and removing the respective container (‘container-kill’ scenario). The replica remains a member of its replica set and is restored when the container restarts. In other words, ‘container-kill’ is very much like restarting a process.

On the positive side, we observed that brief network partitions don’t lead to a noticeable performance drop. Neither MongoDB shows any obvious degradation when one member of a replica set fails, even when such failures are fairly frequent.

Our overall conclusion is that MongoDB is hardly fault tolerant, at least with us as its cooks. We tried our best including contacting some well known experts in the field. In the end we decided to call it a day and publish the results we have.

### Final remarks

During our tests we encountered a number of MongoDB specific features and limitations, including the following:

1. The default durability guarantee in MongoDB has been elevated to “majority” (w:majority) write concern with ‘wtimeout’ option turned on. Not using write timeouts led to long-standing lock waits, while using it without elevating the write concern would lead to inconsistent data, even with statement transaction control in place.
One of our runs with write concern “majority” and 0 wtimeout produced an inconsistent resulting balance. It was using a 4-shard cluster. One of the transactions remained on a secondary replica but was missing on the master.

1. To achieve consistency, all multi-document transactions should prioritize reading from the master of a replica set, as well as setting the ‘writeConcernMajorityJournalDefault’ option on. With this option, MongoDB confirms the write to the client only after the majority of replicas write it to disk.
1. Just as FoundationDB, MongoDB’s WiredTiger storage engine uses multi-version concurrency control to manage transactions. However, in addition to that, MongoDB query layer employs multi-granularity locking that operates on the global, database or collection levels. Unfortunately we could not find why MongoDB uses locks – maybe it’s a legacy of the older MMAPv1 storage engine, for which multi-level locks were a requirement. We can only speculate that this legacy locking scheme has a negative impact on the database performance, both in scale-up and scale-out scenarios.

### Conclusions

This report includes only the most significant test results, as presented in Table 1. To get to these we undertook a 3-month quest in search for the optimal configuration and carried out more than 100 test runs. In the end, we think that comparing MongoDB with FoundationDB and PostgreSQL head to head on the same configuration has little value.

For example, performance of test #1 (one replicaset, 3 nodes with 1 CPU, 8 GB RAM per replica, same as the minimum FDB configuration) was almost 7 times lower (340 vs 2263) than with FoundationDB. ‘Small’ test #5 in scale-out mode (2 replica sets, 2 CPUs and 8 GB of RAM per replica) was 5 times slower than the respective FoundationDB test. MongoDB looks better than FoundationDB only in ‘small’ test #4 (single replica set, 4 CPUs, 8 GB of RAM per replica) - 2661 vs 2263 (17%). No “small” tests were run for PostgreSQL.

Among ‘medium’ tests, the best result is in test #7 (one replica set, 6 CPUs, 16 GB of RAM per replica), is still 2 times slower than a similar ‘medium’ test with FoundationDB  (5 nodes, 1 CPU and 16 GB of RAM per node): 2761 vs 5782 TPS, and 40% slower than a  medium test of PostgreSQL (2 nodes, 4 CPUs and 30 GB of RAM per node), 2761 vs 4663. The best ‘medium’ test in a scale-out cluster is test #12, which is still ~5 times slower than FoundationDB (1171 vs 5782) and 3 times slower than PostgreSQL.

The ‘big’ test #17 (the best overall result for MongoDB) was 3% slower than the ‘big’ test for FoundationDB (3272 vs 3369) and was using way more hardware 36 vs 5 cores and 120 vs 60 GB of RAM.

We did a number of experiments trying to improve performance. Among these are improvements to Stroppy, tweaking the WiredTiger storage subsystem settings, and trying different filesystems. None of these resulted in any significant performance gain.

MongoDB’s sweet spot in the number of concurrent clients is 128, which is also lower than FoundationDB – 512, or PostgreSQL – 256. Adding more clients, with or without tweaks of *wiredTigerConcurrentReadTransactions* and *wiredTigerConcurrentWriteTransactions*, led to a lower throughput.

We concluded that if multi-document transactions are a requirement, it’s best to scale MongoDB up, not out. Even in a relatively large cluster, CPU and disk utilization were close to 100%. With an increase in the number of shards, we certainly observed an increase in performance, but not enough to justify the scaling strategy.

Thanks to a more sophisticated topology, managing MongoDB clusters has also not scored well with us. Such options as using the arbiter or not, setting up configuration servers, choosing the write concern, primaries or secondaries to direct queries to, all of this contributed to a slower adoption while some parts of the cluster were underutilized, and others seemingly bottle-necked.
