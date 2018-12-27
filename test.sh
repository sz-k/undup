#!/usr/bin/env bash
dir=$(cd -P -- "$(dirname -- "$0")" && pwd -P)
cd $dir

rm -rf test
mkdir test
cd test
echo 1 > foo.txt
echo 1 > "foo - Copy.txt"
echo 1 > "foo - Copy (2).txt"
echo 1 > "foo - Copy (3).txt"
echo 22 > "foo - Copy (4).txt"
echo 333 > bar.txt
echo AAA > "bar(1).txt"
echo BBB > "bar(2).txt"
mkdir deep
echo DDDD > deep/baz.txt
echo DDDD > "deep/baz(5).txt"
cd ..

node . --r ./test > output.txt
expectation="test/bar.txt
test/deep
test/deep/baz.txt
test/foo.txt"
result=$(find ./test -exec ls -ld $PWD/{} \; | grep --color=never -o 'test/.*' | sort)

echo 1. file removal
[ "$expectation" = "$result" ] && echo pass || echo fail

expectation="Folder test:
Found 7 file(s)."
result=$(cat output.txt)
rm output.txt

echo 2. console output
[ "$expectation" = "$result" ] && echo pass || echo fail

rm -rf test
