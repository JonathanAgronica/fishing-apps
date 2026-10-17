#!/bin/bash
set -e
cd /workspace/fishing-site-src
sed "s#^SRC='/workspace/fishing-site-src'; SITE='/workspace/fishing-site'#SRC='/workspace/fishing-site-src'; SITE='/tmp/site-test'#" build.py > /tmp/build_test.py
python3 /tmp/build_test.py | tail -1
cp -r /workspace/fishing-site/data/sysg /workspace/fishing-site/data/gauges.json /workspace/fishing-site/data/539132_mimdale.csv /tmp/site-test/data/
