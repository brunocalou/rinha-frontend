// const json = {
//   glossary: {
//     title: "example glossary",
//     GlossDiv: {
//       title: "S",
//       GlossList: {
//         GlossEntry: {
//           ID: "SGML",
//           SortAs: "SGML",
//           GlossTerm: "Standard Generalized Markup Language",
//           Acronym: "SGML",
//           Abbrev: "ISO 8879:1986",
//           GlossDef: {
//             para: "A meta-markup language, used to create markup languages such as DocBook.",
//             GlossSeeAlso: ["GML", "XML"],
//           },
//           GlossSee: "markup",
//         },
//       },
//     },
//     GlossDiv2: {
//       title: "S",
//       GlossList: {
//         GlossEntry: {
//           ID: "SGML",
//           SortAs: "SGML",
//           GlossTerm: "Standard Generalized Markup Language",
//           Acronym: "SGML",
//           Abbrev: "ISO 8879:1986",
//           GlossDef: {
//             para: "A meta-markup language, used to create markup languages such as DocBook.",
//             GlossSeeAlso: ["GML", "XML"],
//           },
//           GlossSee: "markup",
//         },
//       },
//     },
//   },
// };

const json = {
  Actors: [
    {
      name: "Tom Cruise",
      age: 56,
      "Born At": "Syracuse, NY",
    },
    {
      name: "Tom Cruise",
      age: 56,
      "Born At": "Syracuse, NY",
      details: {
        name: "Tom Cruise",
        age: 56,
        "Born At": "Syracuse, NY",
        children: ["value 1", "value 2", { a: 123 }],
      },
    },
  ],
};

function getArrayLine(value: string, depth = 0): HTMLElement {
  const div = document.createElement("div");
  div.style.paddingLeft = `${16 * depth}px`;

  const span1 = document.createElement("span");
  span1.classList.add("text-accent");
  span1.appendChild(document.createTextNode(`${value}: `));
  div.appendChild(span1);

  const span2 = document.createElement("span");
  span2.classList.add("font-bold", "text-brackets");
  span2.appendChild(document.createTextNode("["));
  div.appendChild(span2);

  return div;
}

function getCloseArrayLine(depth = 0): HTMLElement {
  const div = document.createElement("div");
  div.classList.add("text-brackets");
  div.style.paddingLeft = `${16 * depth}px`;
  div.appendChild(document.createTextNode("]"));

  return div;
}

function getObjectLine(
  index: string,
  objectSize: number,
  depth: number,
  lineParent: LineParent,
): HTMLElement {
  const div = document.createElement("div");
  div.classList.add(
    "relative",
    lineParent === "object" ? "text-accent" : "text-gray-200",
  );
  div.style.paddingLeft = `${16 * depth}px`;

  const span1 = document.createElement("span");
  span1.appendChild(document.createTextNode(`${index}:`));
  div.appendChild(span1);

//   const line = document.createElement("span");
//   line.classList.add(
//     "absolute",
//     "left-0",
//     "h-full",
//     "w-[1px]",
//     "origin-top-left",
//     "border-l-[1px]",
//     "border-gray-200",
//   );
//   line.style.transform = `scaleY(${objectSize * 100 + 100}%)`;
//   div.appendChild(line);

  return div;
}

function getPropertyLine(
  key: string,
  value: any,
  depth: number,
  lineParent: LineParent,
): HTMLElement {
  const formattedValue = typeof value === "string" ? `"${value}"` : value;

  const div = document.createElement("div");
  div.classList.add("relative");
  div.style.marginLeft = `${16 * depth}px`;

  const span1 = document.createElement("span");
  span1.classList.add(
    lineParent === "object" ? "text-accent" : "text-gray-200",
  );
  span1.appendChild(document.createTextNode(`${key}: `));
  div.appendChild(span1);
  div.appendChild(document.createTextNode(formattedValue));

  //   const line = document.createElement("span");
  //   line.classList.add(
  //     "absolute",
  //     "h-full",
  //     "w-[1px]",
  //     "origin-top-left",
  //     "border-l-[1px]",
  //     "border-gray-200",
  //   );
  //   line.style.left = "-16px";
  //   div.appendChild(line);

  return div;
}

type LineParent = "object" | "array";

class JsonRenderer {
  private json: Record<string, any>;
  private root: HTMLElement;
  private amountOfLines = 0;

  constructor(json: Record<string, any>, root: HTMLElement) {
    this.json = json;
    this.root = root;
    this.amountOfLines = JsonRenderer.countLines(json);
    // It doesn't account for line breaks
    root.style.minHeight = `${
      +getComputedStyle(root).lineHeight.replace("px", "") * this.amountOfLines
    }px`;
    this.appendLines(
      JsonRenderer.toLines(json, 0, Array.isArray(json) ? "array" : "object"),
    );
  }

  private appendLines(lines: HTMLElement[]) {
    for (let line of lines) {
      this.root.appendChild(line);
    }
  }

  private static countLines(json: Record<string, any>): number {
    let counter = 0;

    for (let value of Object.values(json)) {
      const isArray = Array.isArray(value);
      const isObject = value instanceof Object;

      if (isArray) {
        counter += 2 + JsonRenderer.countLines(value);
      } else if (isObject) {
        counter += 1 + JsonRenderer.countLines(value);
      } else {
        counter += 1;
      }
    }

    return counter;
  }

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
        lines.push(getArrayLine(key, depth));
        lines.push(...JsonRenderer.toLines(value, depth + 1, "array"));
        lines.push(getCloseArrayLine(depth));
      } else if (isObject) {
        lines.push(
          getObjectLine(key, JsonRenderer.countLines(value), depth, parent),
        );
        lines.push(...JsonRenderer.toLines(value, depth + 1, "object"));
      } else {
        lines.push(getPropertyLine(key, value, depth, parent));
      }
    }

    return lines;
  }
}

// Home
const homePage = document.getElementById("home-page")!;
const loadJsonButton = document.getElementById("load-json-button")!;
const loadJsonInput = document.getElementById("load-json-input")!;
const jsonErrorText = document.getElementById("load-json-error")!;

// Json
const jsonPage = document.getElementById("json-page")!;
const jsonNameText = document.getElementById("json-name")!;
const jsonTarget = document.getElementById("json")!;
let jsonRenderer: JsonRenderer | null = null;

async function parseJsonFile(file: File) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      try {
        console.time("parse json file");
        resolve(JSON.parse(event.target!.result as any));
      } catch (error) {
        console.error(error);
        reject(error);
      } finally {
        console.timeEnd("parse json file");
      }
    };
    fileReader.onerror = (error) => reject(error);
    fileReader.readAsText(file);
  });
}

function init() {
  loadJsonInput.addEventListener("change", async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (file) {
      try {
        const json = await parseJsonFile(file);

        jsonNameText.innerText = file.name;
        jsonPage.parentElement!.removeChild(homePage);
        jsonPage.classList.remove("hidden");
        jsonPage.classList.add("flex");

        jsonRenderer = new JsonRenderer(json, jsonTarget);
        // console.time("convert lines");
        // const lines = toLines(
        //   json,
        //   0,
        //   Array.isArray(json) ? "array" : "object",
        // );
        // console.timeEnd("convert lines");

        // console.time("append json");
        // for (let line of lines) {
        //   jsonTarget.appendChild(line);
        // }
        // console.timeEnd("append json");
      } catch (error) {
        console.error(error);
        jsonErrorText.classList.remove("hidden");
      }
    }
  });

  loadJsonButton.addEventListener("click", () => {
    loadJsonInput.click();
  });
}

init();

// TODO: left lines
