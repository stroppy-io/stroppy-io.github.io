set terminal pngcairo size 1920,1000 enhanced font "Sans,11" fontscale 2 linewidth 2
set output "micro_ns.png"

set style data histogram
set style histogram clustered gap 1
set style fill solid 0.85 border -1
set boxwidth 0.85

set title "Key microbenchmarks — ns/op (log scale)" font "Sans,13"
set xlabel ""
set ylabel "ns / op (log scale)"
set logscale y
set yrange [1:10000]
set grid y lt 0 lc "grey" lw 0.5
set key top right
set xtics rotate by -20 noenhanced

$data << EOD
label           before   after
"CharTape"       9.747   2.444
"WordCutter"   160.70   39.11
"Uniq_Next"     17.355   5.483
"Gen_String"   232.10   58.46
"Gen_DateTime" 127.45   16.64
"ProcessArgs"  4635.5  185.7
EOD

plot $data using 2:xtic(1) title "before" lc rgb "#5778a4", \
     $data using 3         title "after"  lc rgb "#e49444"
