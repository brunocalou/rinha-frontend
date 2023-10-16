import "./style.css";
import { JsonRenderer } from "./JsonRenderer";
import { parseJsonFile } from "./parseJsonFile";

// Home
const homePage = document.getElementById("home-page")!;
const loadJsonButton = document.getElementById("load-json-button")!;
const loadJsonInput = document.getElementById("load-json-input")!;
const jsonErrorText = document.getElementById("load-json-error")!;

// Json
const jsonPage = document.getElementById("json-page")!;
const jsonNameText = document.getElementById("json-name")!;
const jsonTarget = document.getElementById("json")!;

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

        new JsonRenderer(json, jsonTarget);
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
