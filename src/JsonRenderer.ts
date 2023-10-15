import { Virtualizer } from "./Virtualizer";

export type LineParent = "object" | "array";

type Line = {
  key?: string;
  value?: any;
  lineParent?: LineParent;
  depth: number;
  type: "array-start" | "array-end" | "object-start" | "property";
};

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

class Page {
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

class DoubleSwapPagination {
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
          this.pageObserverStart.unmount();
          this.pageObserverEnd.unmount();

          this.pages.reverse();
          this.pages[1].pageIndexOffset =
            this.pages[0].pageIndexOffset + this.linesPerPage;
          this.adjustPagesToFitLines();
          this.pages[1].mountOnEnd();

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

export class JsonRenderer {
  static tabSize = 16;
  private json: Record<string, any>;
  private root: HTMLElement;
  private lines: Line[] = [];
  private renderedLines: Array<HTMLElement | null> = [];
  private lineHeight = 0;
  private lineGenerator: Generator<Line>;
  private linesOnInitialLoad = 50;
  private linesPerLoad = 20000;
  private loadLinesTimeoutId = -1;
  private loadedLinesCount = 0;
  private loadLinesInterval = 0;
  private pagination: DoubleSwapPagination;
  private linesPerPage = 1000;

  constructor(json: Record<string, any>, root: HTMLElement) {
    this.json = json;
    this.root = root;
    this.lineHeight = +getComputedStyle(root).lineHeight.replace("px", "");
    this.lineGenerator = JsonRenderer.getLineGenerator(
      this.json,
      0,
      Array.isArray(json) ? "array" : "object",
    );

    console.time("load all lines");
    this.loadNextLines(this.linesOnInitialLoad);

    this.pagination = new DoubleSwapPagination(
      this.root,
      this.lineHeight,
      this.linesPerPage,
      this.mount.bind(this),
      this.unmount.bind(this),
    );

    this.loadLines();
  }

  private loadLines(amount: number = this.linesPerLoad) {
    const isDone = this.loadNextLines(amount);
    this.pagination.updateTotalAmountOfLines(this.lines.length);

    if (isDone) {
      console.timeEnd("load all lines");
      this.pagination.mountVisibleItems();
      return;
    }

    this.loadLinesTimeoutId = setTimeout(() => {
      this.loadLines(this.linesPerLoad);
    }, this.loadLinesInterval);
  }

  private loadNextLines(amount: number) {
    // console.time("load next lines");

    let next: IteratorResult<Line, any> | null = null;
    let counter = 0;

    do {
      next = this.lineGenerator.next();

      if (!next.done) {
        this.lines.push(next.value);

        this.loadedLinesCount += 1;
        counter += 1;
      }
    } while (counter <= amount && !next.done);

    // console.timeEnd("load next lines");
    return next.done;
  }

  private mount(
    pageInstance: Page,
    globalIndex: number,
    localIndex: number,
  ): boolean {
    const line = this.lines[globalIndex];
    let element = this.renderedLines[globalIndex];

    // console.log('mount', line, globalIndex, localIndex);

    if (!line) {
      console.log(`line ${globalIndex} is not ready`);
      return false;
    }

    const top = localIndex * this.lineHeight;

    if (!element) {
      element = JsonRenderer.renderLine(line, top);
      this.renderedLines[globalIndex] = element;
    } else {
      element.style.top = `${top}px`;
    }

    pageInstance.element.appendChild(element);
    return true;
  }

  private unmount(pageInstance: Page, globalIndex: number): boolean {
    const element = this.renderedLines[globalIndex];

    if (element && element.parentElement === pageInstance.element) {
      pageInstance.element.removeChild(element);
    }

    return true;
  }

  private static wrapElement(element: HTMLElement, top: number) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("absolute");
    wrapper.style.top = `${top}px`;

    wrapper.appendChild(element);

    return wrapper;
  }

  private static *getLineGenerator(
    json: Record<string, any>,
    depth = 0,
    lineParent: LineParent,
  ): Generator<Line> {
    for (let [key, value] of Object.entries(json)) {
      const isArray = Array.isArray(value);
      const isObject = value instanceof Object;

      if (isArray) {
        yield { type: "array-start", key, depth };

        yield* JsonRenderer.getLineGenerator(value, depth + 1, "array");

        yield { type: "array-end", depth };
      } else if (isObject) {
        yield { type: "object-start", key, depth, lineParent };

        yield* JsonRenderer.getLineGenerator(value, depth + 1, "object");
      } else {
        yield { type: "property", key, value, depth, lineParent };
      }
    }
  }

  private static renderLine(line: Line, top: number): HTMLElement {
    let element: HTMLElement | null = null;

    if (line.type === "array-start") {
      element = JsonRenderer.getArrayLine(line.key!, line.depth);
    } else if (line.type === "array-end") {
      element = JsonRenderer.getCloseArrayLine(line.depth);
    } else if (line.type === "object-start") {
      element = JsonRenderer.getObjectLine(
        line.key!,
        line.depth,
        line.lineParent!,
      );
    } else {
      element = JsonRenderer.getPropertyLine(
        line.key!,
        line.value,
        line.depth,
        line.lineParent!,
      );
    }

    return JsonRenderer.wrapElement(element, top);
  }

  private static getArrayLine(value: string, depth: number): HTMLElement {
    const div = document.createElement("div");
    div.classList.add("relative");
    div.style.marginLeft = `${JsonRenderer.tabSize * depth}px`;

    const span1 = document.createElement("span");
    span1.classList.add("text-accent");
    span1.appendChild(document.createTextNode(`${value}: `));
    div.appendChild(span1);

    const span2 = document.createElement("span");
    span2.classList.add("font-bold", "text-brackets");
    span2.appendChild(document.createTextNode("["));
    div.appendChild(span2);

    JsonRenderer.appendVerticalLines(div, depth);

    return div;
  }

  private static getCloseArrayLine(depth = 0): HTMLElement {
    const div = document.createElement("div");
    div.classList.add("text-brackets", "relative");
    div.style.marginLeft = `${JsonRenderer.tabSize * depth}px`;
    div.appendChild(document.createTextNode("]"));

    JsonRenderer.appendVerticalLines(div, depth);

    return div;
  }

  private static getObjectLine(
    index: string,
    depth: number,
    lineParent: LineParent,
  ): HTMLElement {
    const div = document.createElement("div");
    div.classList.add(
      "relative",
      lineParent === "object" ? "text-accent" : "text-gray-200",
    );
    div.style.marginLeft = `${JsonRenderer.tabSize * depth}px`;

    const span1 = document.createElement("span");
    span1.appendChild(document.createTextNode(`${index}:`));
    div.appendChild(span1);

    JsonRenderer.appendVerticalLines(div, depth);

    return div;
  }

  private static getVerticalLine(depth: number) {
    const verticalLine = document.createElement("span");

    verticalLine.classList.add(
      "absolute",
      "h-full",
      "w-[1px]",
      "origin-top-left",
      "border-l-[1px]",
      "border-gray-200",
    );
    verticalLine.style.left = `${-JsonRenderer.tabSize * (depth + 1)}px`;

    return verticalLine;
  }

  private static getPropertyLine(
    key: string,
    value: any,
    depth: number,
    lineParent: LineParent,
  ): HTMLElement {
    const formattedValue = typeof value === "string" ? `"${value}"` : value;

    const div = document.createElement("div");
    div.classList.add("relative");
    div.style.marginLeft = `${JsonRenderer.tabSize * depth}px`;

    const span1 = document.createElement("span");
    span1.classList.add(
      lineParent === "object" ? "text-accent" : "text-gray-200",
    );
    span1.appendChild(document.createTextNode(`${key}: `));
    div.appendChild(span1);
    div.appendChild(document.createTextNode(formattedValue));

    JsonRenderer.appendVerticalLines(div, depth);

    return div;
  }

  private static appendVerticalLines(target: HTMLElement, depth: number) {
    for (let i = 0; i < depth; i += 1) {
      target.appendChild(JsonRenderer.getVerticalLine(i));
    }
  }
}
