# Content

*The section contains various content related to stroppy: test results, log data, graphs, links, etc.*

## FoundationDB  

**Test №1**  
**Configuration: 3 nodes on 1 cpu, 8 GB RAM.**  
**Workload: 16 workers, 10 millions accounts, transfer test**  
**Environment: Oracle.Cloud**  

<a href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#first_test_fdb_lat" target="_blank">Latency, interval of 60 seconds</a>
{% responsive_image path: assets/images/small_test_16w_3_nodes_latency.png template:_includes/picture.html title: fdb_lat_1%}  

**Test №3**  
**Configuration: 5 nodes on 1 cpu, 8 GB RAM.**  
**Workload: 512 workers, 10 millions accounts, transfer test**  
**Environment: Oracle.Cloud**  

<a href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#third_test_fdb_lat" target="_blank">Latency, interval of 60 seconds</a>
{% responsive_image path: assets/images/small_test_16w_5_nodes_latency.png template:_includes/picture.html title: fdb_lat_3%} 

**Test №5**  
**Configuration: 5 nodes on 1 cpu, 16 GB RAM.**  
**Workload: 512 workers, 100 millions accounts, transfer test**  
**Environment: Oracle.Cloud**  

<a href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#5_test_fdb_lat" target="_blank">Latency, interval of 60 seconds</a>
{% responsive_image path: assets/images/medium_test_512w_5_nodes_latency.png template:_includes/picture.html title: fdb_lat_5%}  
