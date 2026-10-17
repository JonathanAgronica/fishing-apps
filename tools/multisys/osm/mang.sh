for s in -27.6 -27.0 -26.4 -25.8 -25.2 -24.6; do n=$(python3 -c "print(round($s+0.6,1))")
echo "[out:json][timeout:600];(way[natural=wetland][wetland~\"^(mangrove|saltmarsh|tidalflat)\$\"]($s,151.6,$n,153.6););out geom qt;" > q_m$s.txt
python3 op.py q_m$s.txt mang_$s.json; sleep 5; done
