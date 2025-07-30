export class ProgressBar {
  private total: number;
  private current = 0;
  private barLength: number;
  private lastUpdate = Date.now();

  constructor(total: number, barLength = 40) {
    this.total = total;
    this.barLength = barLength;
  }

  update(current?: number) {
    if (current !== undefined) this.current = current;
    else this.current++;

    const now = Date.now();
    if (now - this.lastUpdate < 100 && this.current < this.total) return;
    this.lastUpdate = now;

    const pct = Math.round((this.current / Math.max(1, this.total)) * 100);
    const filled = Math.round(
      (this.current / Math.max(1, this.total)) * this.barLength,
    );
    const bar =
      "█".repeat(Math.max(0, filled)) +
      "░".repeat(Math.max(0, this.barLength - filled));

    process.stdout.write(
      `\r🚀 Progress: [${bar}] ${pct}% (${this.current}/${this.total})`,
    );

    if (this.current >= this.total) process.stdout.write("\n");
  }

  finish() {
    this.current = this.total;
    this.update();
  }
}
