export class Virtualizer {
  private visibleRange = [0, 0];
  private mountedIndexes: boolean[] = [];
  private extraRangeInPx = 300;

  constructor(
    private root: HTMLElement,
    private itemHeight: number,
    private listSize: number,
    private onMount: (index: number) => boolean,
    private onUnmount: (index: number) => boolean,
  ) {
    this.updateListSize(listSize);
    this.addListeners();
  }

  reset() {
    this.updateListSize(this.listSize);
  }

  updateListSize(newListSize: number) {
    this.listSize = newListSize;
    this.root.style.position = "relative";
    this.root.style.minHeight = `${this.itemHeight * this.listSize}px`;
    this.mountedIndexes = new Array(this.listSize).fill(null);
    this.visibleRange = this.calcVisibleRange();
  }

  mountVisibleItems() {
    for (let i = this.visibleRange[0]; i < this.visibleRange[1]; i += 1) {
      if (!this.mountedIndexes[i]) {
        if (this.onMount(i)) {
          this.mountedIndexes[i] = true;
        }
      }
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

    for (let i = 0; i < this.mountedIndexes.length; i += 1) {
      if (i >= newVisibleRange[0] && i < newVisibleRange[1]) {
        if (!this.mountedIndexes[i]) {
          if (this.onMount(i)) {
            this.mountedIndexes[i] = true;
          }
        }
      } else {
        if (this.mountedIndexes[i]) {
          if (this.onUnmount(i)) {
            this.mountedIndexes[i] = false;
          }
        }
      }
    }

    this.visibleRange = newVisibleRange;
  }

  private addListeners() {
    document.addEventListener("scroll", this.handleScroll.bind(this));
  }
}
