import { Virtualizer } from "./Virtualizer";

export type LineParent = "object" | "array";

export class JsonRenderer {
  static tabSize = 16;
  private json: Record<string, any>;
  private root: HTMLElement;
  private virtualizer: Virtualizer;
  private lines: HTMLElement[];

  constructor(json: Record<string, any>, root: HTMLElement) {
    this.json = json;
    this.root = root;
    const lineHeight = +getComputedStyle(root).lineHeight.replace("px", "");

    // TODO: Improve this time
    // TODO: Render vertical lines separate and keep them always on the page
    console.time("to lines");
    this.lines = JsonRenderer.toLines(
      json,
      0,
      Array.isArray(json) ? "array" : "object",
    ).map((line, index) => this.wrapElement(line, index * lineHeight));
    console.timeEnd("to lines");

    this.virtualizer = new Virtualizer(
      root,
      lineHeight,
      this.lines.length,
      this.mount.bind(this),
      this.unmount.bind(this),
    );
  }

  private mount(index: number) {
    const element = this.lines[index];

    if (element) {
      this.root.appendChild(element);
    }
  }

  private unmount(index: number) {
    const element = this.lines[index];

    if (element) {
      this.root.removeChild(element);
    }
  }

  private wrapElement(element: HTMLElement, top: number) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("absolute");
    wrapper.style.top = `${top}px`;

    wrapper.appendChild(element);

    return wrapper;
  }

  //   private static countLines(json: Record<string, any>): number {
  //     let counter = 0;

  //     for (let value of Object.values(json)) {
  //       const isArray = Array.isArray(value);
  //       const isObject = value instanceof Object;

  //       if (isArray) {
  //         counter += 2 + JsonRenderer.countLines(value);
  //       } else if (isObject) {
  //         counter += 1 + JsonRenderer.countLines(value);
  //       } else {
  //         counter += 1;
  //       }
  //     }

  //     return counter;
  //   }

  private static toLines(
    json: Record<string, any>,
    depth = 0,
    parent: LineParent,
  ): HTMLElement[] {
    const lines: HTMLElement[] = [];

    for (let [key, value] of Object.entries(json)) {
      const isArray = Array.isArray(value);
      const isObject = value instanceof Object;

      if (isArray) {
        lines.push(JsonRenderer.getArrayLine(key, depth));
        lines.push(...JsonRenderer.toLines(value, depth + 1, "array"));
        lines.push(JsonRenderer.getCloseArrayLine(depth));
      } else if (isObject) {
        lines.push(JsonRenderer.getObjectLine(key, depth, parent));
        lines.push(...JsonRenderer.toLines(value, depth + 1, "object"));
      } else {
        lines.push(JsonRenderer.getPropertyLine(key, value, depth, parent));
      }
    }

    return lines;
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
