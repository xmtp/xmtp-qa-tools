#!/usr/bin/env python3

import sys
import pandas as pd

def calculate_fork_scores(csv_file):
    try:
        df = pd.read_csv(csv_file)
    except Exception as e:
        print("Error loading CSV:", e)
        sys.exit(1)

    if "num_forks" not in df.columns:
        print("Error: CSV must contain a 'num_forks' column.")
        sys.exit(1)

    # Clean up column names
    df.columns = df.columns.str.strip()

    # Normalize column types
    for col in df.columns:
        if col != "num_forks":
            df[col] = pd.to_numeric(df[col], errors="ignore")

    fork_scores = {}

    print("\nProcessing rows...\n")

    for index, row in df.iterrows():
        try:
            forks = int(row["num_forks"])
        except:
            continue

        print("Row {} | num_forks = {}".format(index, forks))

        for col in df.columns:
            if col == "num_forks":
                continue

            if col == "ENABLED_OPS":
                # Split operations string and process each individual op
                val = str(row[col])
                if pd.isna(val) or val.strip() == "":
                    continue

                ops = [op.strip() for op in val.split("-") if op.strip()]
                for op in ops:
                    if op not in fork_scores:
                        fork_scores[op] = 0

                    if forks > 0:
                        fork_scores[op] += 1
                        print("  ENABLED_OPS -> '{}' | forked -> +1".format(op))
                    else:
                        fork_scores[op] -= 1
                        print("  ENABLED_OPS -> '{}' | no fork -> -1".format(op))
            else:
                val = row[col]
                if pd.isna(val):
                    continue

                enabled = val != 0
                if col not in fork_scores:
                    fork_scores[col] = 0

                if enabled and forks > 0:
                    fork_scores[col] += 1
                    print("  {}={} enabled | forked -> +1".format(col, val))
                elif (enabled and forks == 0) or (not enabled and forks > 0):
                    fork_scores[col] -= 1
                    print("  {}={} mismatch | -> -1".format(col, val))

    # Sort and print results
    sorted_scores = dict(sorted(fork_scores.items(), key=lambda item: item[1], reverse=True))

    print("\nFinal Fork Correlation Scores:")
    print("------------------------------")
    for key, val in sorted_scores.items():
        print("{}: {}".format(key, val))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python fork_score.py <csv_file>")
        sys.exit(1)

    calculate_fork_scores(sys.argv[1])
