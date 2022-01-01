# Материалы

*Раздел содержит различные материалы, связанные со stroppy: результаты тестов, данные логов, графики, ссылки и т.д.*

## FoundationDB  

**Тест №1**  
**Конфигурация: 3 узла по 1 cpu, 8 ГБ RAM.**  
**Рабочая нагрузка: 16 воркеров, 10 миллионов счетов, тест переводов**  
**Среда тестирования: Oracle.Cloud**  

<a href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#first_test_fdb_lat" target="_blank">Задержка, интервал 60 секунд</a>
{% responsive_image path: assets/images/small_test_16w_3_nodes_latency.png template:_includes/picture.html title: fdb_lat_1 %}

**Тест №3**  
**Конфигурация: 5 узлов по 1 cpu, 8 ГБ RAM.**  
**Рабочая нагрузка: 512 воркеров, 10 миллионов счетов, тест переводов**  
**Среда тестирования: Oracle.Cloud**  

<a href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#third_test_fdb_lat" target="_blank">Задержка, интервал 60 секунд</a>
{% responsive_image path: assets/images/small_test_16w_5_nodes_latency.png template:_includes/picture.html title: fdb_lat_2%}  

**Тест №5**  
**Конфигурация: 5 узлов по 1 cpu, 16 ГБ RAM.**  
**Рабочая нагрузка: 512 воркеров, 100 миллионов счетов, тест переводов**  
**Среда тестирования: Oracle.Cloud**  

<a href="{{ site.baseurl }}/{{ lang }}reports/fdb-report.html#5_test_fdb_lat" target="_blank">Задержка, интервал 60 секунд</a>
{% responsive_image path: assets/images/medium_test_512w_5_nodes_latency.png template:_includes/picture.html title: fdb_lat_5%}  
