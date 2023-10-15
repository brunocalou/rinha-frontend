import { Virtualizer } from "./Virtualizer";

export class Page {
  element: HTMLElement;
  private virtualizer: Virtualizer;

  constructor(
    private root: HTMLElement,
    private lineHeight: number,
    private lines: number,
    public pageIndexOffset: number,
    private onMount: (
      page: Page,
      globalIndex: number,
      localIndex: number,
    ) => boolean,
    private onUnmount: (
      page: Page,
      globalIndex: number,
      localIndex: number,
    ) => boolean,
  ) {
    this.element = document.createElement("div");
    this.virtualizer = new Virtualizer(
      this.element,
      this.lineHeight,
      this.lines,
      (index) => {
        return this.onMount(this, this.pageIndexOffset + index, index);
      },
      (index) => {
        return this.onUnmount(this, this.pageIndexOffset + index, index);
      },
    );
  }

  mountVisibleItems() {
    this.virtualizer.mountVisibleItems();
  }

  updateLines(newLines: number) {
    if (this.lines !== newLines) {
      this.lines = newLines;
      this.virtualizer.updateListSize(newLines);
    }
  }

  mountOnStart() {
    this.element.textContent = "";
    this.root.prepend(this.element);
    this.virtualizer.reset();
    this.virtualizer.mountVisibleItems();
  }

  mountOnEnd() {
    this.element.textContent = "";
    this.root.appendChild(this.element);
    this.virtualizer.reset();
    this.virtualizer.mountVisibleItems();
  }
}

class PageSwapObserver {
  element: HTMLElement;
  observer: IntersectionObserver;

  constructor(
    private root: HTMLElement,
    public role: "observe-start" | "observe-end",
    rootMargin: string,
    private onIntersect: (isIntersecting: boolean) => void,
  ) {
    this.element = document.createElement("div");
    this.element.style.height = "1px";
    this.element.style.width = "1px";
    this.observer = new IntersectionObserver(
      (entries) => {
        this.onIntersect(entries[0].isIntersecting);
      },
      {
        rootMargin,
      },
    );

    this.observer.observe(this.element);
  }

  unmount() {
    this.root.removeChild(this.element);
  }

  mount() {
    if (this.role === "observe-start") {
      this.mountOnStart();
    } else {
      this.mountOnEnd();
    }
  }

  private mountOnStart() {
    this.root.prepend(this.element);
  }

  private mountOnEnd() {
    this.root.appendChild(this.element);
  }
}

export class DoubleSwapPagination {
  private pages: Page[] = [];
  private pageObserverStart: PageSwapObserver;
  private pageObserverEnd: PageSwapObserver;
  private totalAmountOfLines = Infinity;

  constructor(
    private root: HTMLElement,
    private lineHeight: number,
    private linesPerPage: number,
    private onMount: (
      page: Page,
      globalIndex: number,
      localIndex: number,
    ) => boolean,
    private onUnmount: (
      page: Page,
      globalIndex: number,
      localIndex: number,
    ) => boolean,
  ) {
    for (let i = 0; i < 2; i += 1) {
      const page = new Page(
        this.root,
        this.lineHeight,
        this.linesPerPage,
        i * this.linesPerPage,
        this.onMount,
        this.onUnmount,
      );
      this.pages.push(page);
      page.mountOnEnd();
    }

    const rootMarginBase =
      Math.min(100, 0.1 * this.linesPerPage) * this.lineHeight;

    this.pageObserverStart = new PageSwapObserver(
      this.root,
      "observe-start",
      `${rootMarginBase * 2}px`,
      (isIntersecting) => {
        if (isIntersecting) {
          const shouldSwap = this.pages[0].pageIndexOffset !== 0;
          if (shouldSwap) {
            const currentScroll = window.scrollY;
            this.pageObserverStart.unmount();
            this.pageObserverEnd.unmount();

            this.pages.reverse();
            this.pages[0].pageIndexOffset =
              this.pages[1].pageIndexOffset - this.linesPerPage;
            this.adjustPagesToFitLines();

            this.pages[0].mountOnStart();

            window.scrollTo({
              behavior: "instant",
              top: currentScroll + this.linesPerPage * this.lineHeight,
            });

            this.pageObserverStart.mount();
            this.pageObserverEnd.mount();
          }
        }
      },
    );
    this.pageObserverEnd = new PageSwapObserver(
      this.root,
      "observe-end",
      `${rootMarginBase}px`,
      (isIntersecting) => {
        if (
          isIntersecting &&
          this.pages[1].pageIndexOffset + this.linesPerPage <
            this.totalAmountOfLines
        ) {
          const currentScroll = window.scrollY;
          this.pageObserverStart.unmount();
          this.pageObserverEnd.unmount();

          this.pages.reverse();
          this.pages[1].pageIndexOffset =
            this.pages[0].pageIndexOffset + this.linesPerPage;
          this.adjustPagesToFitLines();
          this.pages[1].mountOnEnd();

          window.scrollTo({
            behavior: "instant",
            top: currentScroll - this.linesPerPage * this.lineHeight,
          });

          this.pageObserverStart.mount();
          this.pageObserverEnd.mount();
        }
      },
    );

    this.pageObserverStart.mount();
    this.pageObserverEnd.mount();
  }

  mountVisibleItems() {
    this.pages.forEach((page) => page.mountVisibleItems());
  }

  updateTotalAmountOfLines(newTotalAmountOfLines: number) {
    this.adjustPagesToFitLines(newTotalAmountOfLines);
  }

  private adjustPagesToFitLines(
    amountOfLines: number = this.totalAmountOfLines,
  ) {
    this.totalAmountOfLines = amountOfLines;

    if (amountOfLines < this.linesPerPage) {
      this.pages[0].updateLines(amountOfLines);
      this.pages[1].updateLines(0);
    } else {
      this.pages[0].updateLines(this.linesPerPage);

      if (this.pages[1].pageIndexOffset > amountOfLines - this.linesPerPage) {
        this.pages[1].updateLines(
          amountOfLines - this.pages[1].pageIndexOffset,
        );
      } else {
        this.pages[1].updateLines(this.linesPerPage);
      }
    }
  }
}
