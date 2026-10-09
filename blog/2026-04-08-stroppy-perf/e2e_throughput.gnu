set terminal pngcairo size 1800,960 enhanced font "Sans,12" fontscale 2 linewidth 2
set output "e2e_throughput.png"

set style data histogram
set style histogram clustered gap 1
set style fill solid 0.85 border -1
set boxwidth 0.8

set title "tpcc/pick throughput — noop driver (median of 3×30s runs)" font "Sans,13"
set xlabel "Virtual Users"
set ylabel "Iterations / second"
set yrange [0:130000]
set format y "%'.0f"
set grid y lt 0 lc "grey" lw 0.5
set key top left

set xtics ("1" 0, "2" 1, "4" 2, "8" 3, "16" 4)

# before, after
$data << EOD
"1"  25424  29421
"2"  43175  50072
"4"  65919  74566
"8"  90264  100419
"16" 100170 111489
EOD

plot $data using 2:xtic(1) title "before" lc rgb "#5778a4", \
     $data using 3         title "after"  lc rgb "#e49444"
