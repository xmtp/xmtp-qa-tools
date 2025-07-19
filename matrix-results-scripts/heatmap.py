#!/usr/bin/env python3

import sys
import pandas as pd
import xlsxwriter

def get_gradient_color(value, min_val, max_val):
    """
    Excel's default 3-color gradient:
    Green (#63BE7B) -> Yellow (#FFEB84) -> Red (#F8696B)
    """
    if max_val == min_val:
        return "#FFEB84"  # neutral yellow

    ratio = (value - min_val) / float(max_val - min_val)

    if ratio < 0.5:
        # Green to Yellow
        ratio *= 2
        red   = int(99 + ratio * (255 - 99))     # 99 -> 255
        green = int(190 + ratio * (235 - 190))   # 190 -> 235
        blue  = int(123 + ratio * (132 - 123))   # 123 -> 132
    else:
        # Yellow to Red
        ratio = (ratio - 0.5) * 2
        red   = int(255 + ratio * (248 - 255))   # 255 -> 248
        green = int(235 + ratio * (105 - 235))   # 235 -> 105
        blue  = int(132 + ratio * (107 - 132))   # 132 -> 107

    red = max(0, min(255, red))
    green = max(0, min(255, green))
    blue = max(0, min(255, blue))

    return "#{:02X}{:02X}{:02X}".format(red, green, blue)

def generate_heatmap_excel(input_csv, output_xlsx):
    # Load CSV with columns: label,val
    try:
        df = pd.read_csv(input_csv)
    except Exception as e:
        print("Failed to load CSV:", e)
        sys.exit(1)

    if "label" not in df.columns or "val" not in df.columns:
        print("CSV must contain 'label' and 'val' columns.")
        sys.exit(1)

    min_val = df["val"].min()
    max_val = df["val"].max()

    workbook = xlsxwriter.Workbook(output_xlsx)
    worksheet = workbook.add_worksheet("Heatmap")

    # Headers
    worksheet.write(0, 0, "Label")
    worksheet.write(0, 1, "Score")

    for i, row in enumerate(df.itertuples(index=False), start=1):
        label = row.label
        val = row.val
        color = get_gradient_color(val, min_val, max_val)
        fmt = workbook.add_format({"bg_color": color})
        worksheet.write(i, 0, label, fmt)
        worksheet.write(i, 1, val)

    workbook.close()
    print("Saved to", output_xlsx)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python label_heatmap_excel.py <input.csv>")
        sys.exit(1)

    input_csv = sys.argv[1]
    output_xlsx = input_csv.replace(".csv", "_heatmap.xlsx")
    generate_heatmap_excel(input_csv, output_xlsx)
