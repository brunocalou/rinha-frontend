import { Virtualizer } from "./Virtualizer";

export type LineParent = "object" | "array";

type Line = {
  key?: string;
  value?: any;
  lineParent?: LineParent;
  depth: number;
  type: "array-start" | "array-end" | "object-start" | "property";
};

class Page {
  element: HTMLElement;
  virtualizer: Virtualizer;

  constructor(
    private itemHeight: number,
    private lines: number,
    private onMount: (page: Page, index: number) => boolean,
    private onUnmount: (page: Page, index: number) => boolean,
  ) {
    this.element = document.createElement("div");
    this.element.classList.add("relative");
    this.virtualizer = new Virtualizer(
      this.element,
      this.itemHeight,
      this.lines,
      (index) => {
        return this.onMount(this, index);
      },
      (index) => {
        return this.onUnmount(this, index);
      },
    );
  }

  updateLines(newLines: number) {
    this.lines = newLines;
    this.virtualizer.updateListSize(newLines);
  }
}

class Pagination {
  private pages: Page[] = [];

  constructor(
    private root: HTMLElement,
    private itemHeight: number,
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
  ) {}

  createPagesToFitLines(amountOfLines: number) {
    const amountOfPages = Math.floor(amountOfLines / this.linesPerPage) + 1;

    if (this.pages.length < amountOfPages) {
      for (let i = this.pages.length; i < amountOfPages; i += 1) {
        const page = new Page(
          this.itemHeight,
          this.linesPerPage,
          (pageInstance, pageLineIndex) => {
            return this.onMount(
              pageInstance,
              pageLineIndex + i * this.linesPerPage,
              pageLineIndex,
            );
          },
          (pageInstance, pageLineIndex) => {
            return this.onUnmount(
              pageInstance,
              pageLineIndex + i * this.linesPerPage,
              pageLineIndex,
            );
          },
        );
        this.pages.push(page);
        /**
         * TODO: 
         * - Use just 2 pages at any time (double buffer swap technique)
         * - Swap their positions on root according to the scroll
         * - Disable virtualizer when the page is out of view
         **/
        this.root.appendChild(page.element);
        page.virtualizer.mountVisibleItems();
      }
    }
  }

  adjustLastPageToFitLines(amountOfLines: number) {
    const lastPage = this.pages[this.pages.length - 1];
    const currentTotalAmountOfLines = this.pages.length * this.linesPerPage;
    const extraLines = currentTotalAmountOfLines - amountOfLines;
    const expectedLastPageSize = this.linesPerPage - extraLines;
    lastPage.updateLines(expectedLastPageSize);
  }
}

export class JsonRenderer {
  static tabSize = 16;
  private json: Record<string, any>;
  private root: HTMLElement;
  private lines: Line[] = [];
  private lineCount = 0;
  private renderedLines: Array<HTMLElement | null> = [];
  private lineHeight = 0;
  private lineGenerator: Generator<Line>;
  private linesOnInitialLoad = 50;
  private linesPerLoad = 20000;
  private loadLinesTimeoutId = -1;
  private loadedLinesCount = 0;
  private loadLinesInterval = 0;
  private pagination: Pagination;
  private linesPerPage = 1e4;

  constructor(json: Record<string, any>, root: HTMLElement) {
    this.json = json;
    this.root = root;
    this.lineHeight = +getComputedStyle(root).lineHeight.replace("px", "");

    this.pagination = new Pagination(
      this.root,
      this.lineHeight,
      this.linesPerPage,
      this.mount.bind(this),
      this.unmount.bind(this),
    );

    this.lineGenerator = JsonRenderer.getLineGenerator(
      this.json,
      0,
      Array.isArray(json) ? "array" : "object",
    );

    console.time("load all lines");
    this.loadLines(this.linesOnInitialLoad);
  }

  private loadLines(amount: number) {
    const isDone = this.loadNextLines(amount);
    this.pagination.createPagesToFitLines(this.lines.length);

    if (isDone) {
      console.log("Finished loading lines");
      console.log(this.lineCount, this.lines.length);
      console.timeEnd("load all lines");
      this.pagination.adjustLastPageToFitLines(this.lines.length);
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

    if (!line) {
      return false;
    }

    if (!element) {
      element = JsonRenderer.renderLine(line, localIndex * this.lineHeight);
      this.renderedLines[globalIndex] = element;
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
