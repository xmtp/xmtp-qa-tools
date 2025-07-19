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

    df.columns = df.columns.str.strip()

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

                if col not in fork_scores:
                    fork_scores[col] = 0

                try:
                    min_val = df[col].min()
                    max_val = df[col].max()

                    if min_val == max_val:
                        print("  {}={} (CONSTANT) | skipped".format(col, val))
                        continue

                    is_max = val == max_val
                    is_min = val == min_val

                    if is_max and forks > 0:
                        fork_scores[col] += 1
                        print("  {}={} (MAX) | forked -> +1".format(col, val))
                    elif is_max and forks == 0:
                        fork_scores[col] -= 1
                        print("  {}={} (MAX) | no fork -> -1".format(col, val))
                    elif is_min:
                        fork_scores[col] -= 1
                        label = "forked" if forks > 0 else "no fork"
                        print("  {}={} (MIN) | {} -> -1".format(col, val, label))
                    else:
                        print("  {}={} (neutral) | no score change".format(col, val))

                except Exception as e:
                    print("  Skipping {} due to error: {}".format(col, e))
                    continue

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
