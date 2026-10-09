set terminal pngcairo size 1640,880 enhanced font "Sans,12" fontscale 2 linewidth 2
set output "load_speedup.png"

set style fill solid 0.85 border -1
set style data histograms
set boxwidth 0.6

set title "load\\_data speedup by table — SF=20, noop driver" font "Sans,13"
set xlabel ""
set ylabel "Speedup (×)"
set yrange [0:9]
set grid y lt 0 lc "grey" lw 0.5
set key off

# label bars with value
set label 1 "3.6×" at 0, 3.6+0.25 center font "Sans,11"
set label 2 "7.6×" at 1, 7.6+0.25 center font "Sans,11"
set label 3 "3.9×" at 2, 3.9+0.25 center font "Sans,11"
set label 4 "3.6×" at 3, 3.6+0.25 center font "Sans,11"

# reference line at 1×
set arrow from -0.5, 1 to 3.5, 1 nohead lc rgb "#cc3333" lw 1.5 dt 2

$data << EOD
"item"     3.6
"district" 7.6
"customer" 3.9
"stock"    3.6
EOD

plot $data using 2:xtic(1) lc rgb "#e49444"
