export class Virtualizer {
  private visibleRange = [0, 0];
  private mountedIndexes: boolean[];
  private extraRangeInPx = 100;

  constructor(
    private root: HTMLElement,
    private itemHeight: number,
    private listSize: number,
    private onMount: (index: number) => void,
    private onUnmount: (index: number) => void,
  ) {
    root.style.position = "relative";
    root.style.minHeight = `${itemHeight * listSize}px`;
    this.mountedIndexes = new Array(listSize).fill(null);
    this.addListeners();
    this.mountInitial();
  }

  private mountInitial() {
    this.visibleRange = this.calcVisibleRange();

    for (let i = this.visibleRange[0]; i < this.visibleRange[1]; i += 1) {
      this.mountedIndexes[i] = true;
      this.onMount(i);
    }
  }

  private calcVisibleRange() {
    const rect = this.root.getBoundingClientRect();
    const start = Math.min(
      rect.height,
      Math.max(0, -rect.top - this.extraRangeInPx),
    );
    const end = Math.max(
      0,
      -rect.top + window.innerHeight + this.extraRangeInPx,
    );

    const indexStart = Math.min(
      this.listSize,
      Math.floor(start / this.itemHeight),
    );
    const indexEnd = Math.min(
      this.listSize,
      Math.max(0, Math.floor(end / this.itemHeight) - 1),
    );

    return [indexStart, indexEnd];
  }

  private handleScroll() {
    const newVisibleRange = this.calcVisibleRange();

    for (let i = this.visibleRange[0]; i < this.visibleRange[1]; i += 1) {
      if (i >= newVisibleRange[0] && i <= newVisibleRange[1]) {
        continue;
      }

      if (this.mountedIndexes[i] !== null) {
        // console.log("unmount", i, this.mountedIndexes[i]);
        this.mountedIndexes[i] = false;
        this.onUnmount(i);
      }
    }

    for (let i = newVisibleRange[0]; i < newVisibleRange[1]; i += 1) {
      if (!this.mountedIndexes[i]) {
        // console.log("mount", i, this.mountedIndexes[i]);
        this.mountedIndexes[i] = true;
        this.onMount(i);
      }
    }
    this.visibleRange = newVisibleRange;
  }

  private addListeners() {
    document.addEventListener("scroll", this.handleScroll.bind(this));
  }
}
