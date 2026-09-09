#!/bin/sh
# Everything, in the order a failure is cheapest to diagnose.
set -e
cd "$(dirname "$0")/.."
MODULES="beyond-normal-incidence rocks-and-stiffness fluid-in-the-pores rock-to-trace offset-and-the-gather add-offset intercept-gradient same-amplitude reading-a-gather what-survives"
echo "== the repository is complete and consistent =="
node tools/verify-deploy.js | grep -E "FAIL|note|complete and internally|PROBLEMS" | sed 's/^/  /'
echo "== physics against closed forms =="
node tools/verify-physics.js | tail -2
for m in $MODULES; do
  echo "== $m =="
  MOD=$m.html node tools/harness.js | grep -E "FAIL" || true
  MOD=$m.html node tools/harness.js | grep -c "  ok " | sed 's/^/  checks passing: /'
  MOD=$m.html node tools/harness.js geometry | tail -2 | head -1
  MOD=$m.html node tools/harness.js labels   | tail -2 | head -1
  MOD=$m.html node tools/harness.js axes     | tail -2 | head -1
  MOD=$m.html node tools/harness.js scales   | tail -2 | head -1
done
echo "== the control panel in its second window =="
for m in $MODULES; do
  printf "  %-30s " "$m"
  node tools/harness-panelout.js modules/$m.html | tail -1
done
echo "== every number quoted in the prose =="
for f in verify-prose-m00 verify-prose-m01-rock verify-prose-m02 verify-prose-m03 verify-prose-m04 verify-prose-m05 verify-prose-m06 verify-prose-m07 verify-prose-m08 verify-prose-m09; do
  node tools/$f.js | tail -2 | head -1
done
echo "== the usage counter =="
node tools/verify-count.js | tail -2 | head -1
echo "== syntax =="
node --check assets/rockphysics.js && echo "  ok   rockphysics.js"
node --check assets/count.js && echo "  ok   count.js"
for m in $MODULES; do
  sed -n '/^<script>$/,/^<\/script>$/p' modules/$m.html | sed '1d;$d' > /tmp/_inline.js
  node --check /tmp/_inline.js && echo "  ok   $m inline script"
done
