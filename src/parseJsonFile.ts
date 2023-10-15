export async function parseJsonFile(file: File) {
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
