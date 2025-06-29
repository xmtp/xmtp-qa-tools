#!/bin/bash

for y in {1..2}; {
        for x in {1..5}; {
                rm -rf .data
                mkdir -p logs
                tid=$(date +%s)
                log="logs/keyrotation-forkrepro-$tid.out"
                echo "Running test with log: $log";
                RUST_BACKTRACE=1 LOGGING_LEVEL=debug timeout 300 npx vitest run suites/networkchaos/keyrotation.test.ts    --pool=threads --poolOptions.singleThread=true --fileParallelism=false >& $log
        }
        cd multinode && docker compose down && ./ci.sh && cd ..
        sleep 10
}